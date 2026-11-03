
import { useState } from 'react'
import './App.css'

async function getGitHubError(response) {
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('X-RateLimit-Remaining');

    if (remaining === '0' || response.status === 429) {
      return 'GitHub API rate limit reached. Please wait a while before searching again.';
    }

    return 'GitHub has temporarily restricted this request. Please try again later.';
  }

  if (response.status >= 500) {
    return 'GitHub servers are temporarily unavailable. Please try again later.';
  }

  return `GitHub request failed (${response.status}). Please try again.`;
}

function App() {
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [repositories, setRepositories] = useState([])
  const [repoSearch, setRepoSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  async function searchGitHub(event) {
    event.preventDefault();

    const searchName = username.trim();

    if (!searchName) {
      setError('Please enter a GitHub username.');
      setProfile(null);
      setRepositories([]);
      setPage(1);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError('');
    setProfile(null);
    setRepositories([]);
    setPage(1);
    setHasMore(false);
    setRepoSearch('');
    setLanguageFilter('All');
    setSortBy('updated');

    try {
      // Fetch GitHub profile
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(searchName)}`
      );

      if (response.status === 404) {
        throw new Error('GitHub username not found. Please try another.');
      }

      if (!response.ok) {
        throw new Error(await getGitHubError(response));
      }

      const data = await response.json();
      setProfile(data);

      // Fetch the first page of repositories
      try {
        const repoResponse = await fetch(
          `https://api.github.com/users/${encodeURIComponent(searchName)}/repos?sort=updated&per_page=100&page=1`
        );

        if (!repoResponse.ok) {
          throw new Error(await getGitHubError(repoResponse));
        }

        const repoData = await repoResponse.json();

        setRepositories(repoData);
        setPage(1);
        setHasMore(repoData.length === 100);
      } catch (repoError) {
        setError(
          `Profile loaded, but repositories could not be fetched. ${repoError.message || 'Please try again.'}`
        );
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }
async function loadMoreRepositories() {
  if (!profile || loadingMore || !hasMore) return;

  setLoadingMore(true);
  setError('');

  try {
    const nextPage = page + 1;

    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(profile.login)}/repos?sort=updated&per_page=100&page=${nextPage}`
    );

    if (!response.ok) {
      throw new Error(await getGitHubError(response));
    }

    const newRepositories = await response.json();

    setRepositories((previousRepositories) => [
      ...previousRepositories,
      ...newRepositories,
    ]);

    setPage(nextPage);
    setHasMore(newRepositories.length === 100);
  } catch (err) {
    if (err instanceof TypeError) {
      setError('Network error. Please check your internet connection.');
    } else {
      setError(err.message || 'Unable to load more repositories.');
    }
  } finally {
    setLoadingMore(false);
  }
}

const totalStars = repositories.reduce(
  (total, repo) => total + repo.stargazers_count,
  0
);

const languageCount = new Set(
  repositories
    .map((repo) => repo.language)
    .filter(Boolean)
).size;

const filteredRepositories = repositories
  .filter((repo) => {
    const searchText = repoSearch.trim().toLowerCase();

    const matchesSearch =
      repo.name.toLowerCase().includes(searchText) ||
      (repo.description || '').toLowerCase().includes(searchText);

    const matchesLanguage =
      languageFilter === 'All' ||
      repo.language === languageFilter;

    return matchesSearch && matchesLanguage;
  })
  
  .sort((a, b) => {
    if (sortBy === 'stars') {
      return b.stargazers_count - a.stargazers_count;
    }

    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    }

    return new Date(b.updated_at) - new Date(a.updated_at);
  });

const availableLanguages = [
  ...new Set(
    repositories
      .map((repo) => repo.language)
      .filter(Boolean)
  ),
].sort();


  return (
    <div className="app">
      <header className="header">
        <h1>DevProfile</h1>
        <p>Explore GitHub developers and their projects.</p>
      </header>

      <main className="main">
        <form className="search-form" onSubmit={searchGitHub}>
          <input
            type="text"
            placeholder="Enter a GitHub username..."
            aria-label="GitHub username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p className="status">Fetching GitHub profile...</p>
        )}

        {!profile && !loading && !error && (
          <section className="welcome">
            <h2>Discover developers</h2>
            <p>
              Search for a GitHub username to explore their profile
              and public repositories.
            </p>
          </section>
        )}

        {profile && (
          <section className="profile-card">
            <img
              className="avatar"
              src={profile.avatar_url}
              alt={`${profile.login}'s GitHub avatar`}
            />

            <h2>{profile.name || profile.login}</h2>
            <p className="username">@{profile.login}</p>

            {profile.bio && <p>{profile.bio}</p>}

            {profile.location && (
              <p>📍 {profile.location}</p>
            )}

            <div className="stats">
              <div>
                <strong>{profile.public_repos}</strong>
                <span>Repositories</span>
              </div>

              <div>
                <strong>{profile.followers}</strong>
                <span>Followers</span>
              </div>

              <div>
                <strong>{profile.following}</strong>
                <span>Following</span>
              </div>
            </div>

            <a
              className="profile-link"
              href={profile.html_url}
              target="_blank"
              rel="noreferrer"
            >
              View GitHub Profile
            </a>
          </section>
        )}
        {profile && (
          <section className="repositories">
            <h2>Public Repositories</h2>
            <div className="repo-stats">
              <div className="repo-stat">
                <strong>{repositories.length}</strong>
                <span>Repositories loaded</span>
              </div>

              <div className="repo-stat">
                <strong>{totalStars.toLocaleString()}</strong>
                <span>Total stars</span>
              </div>

              <div className="repo-stat">
                <strong>{languageCount}</strong>
                <span>Languages</span>
              </div>
            </div>
            <div className="repo-controls">
              <input
                type="text"
                placeholder="Search repositories..."
                aria-label="Search repositories"
                value={repoSearch}
                onChange={(event) => setRepoSearch(event.target.value)}
              />

              <select
                aria-label="Filter by programming language"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
              >
                <option value="All">All languages</option>

                {availableLanguages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <select
                aria-label="Sort repositories"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="updated">Recently updated</option>
                <option value="stars">Most stars</option>
                <option value="name-asc">Name: A–Z</option>
                <option value="name-desc">Name: Z–A</option>
              </select>
            </div>

            {filteredRepositories.length === 0 ? (
              <p className="status">
                No repositories match your search and filters.
              </p>
            ) : (
              <div className="repo-grid">
                {filteredRepositories.map((repo) => (
                  <article className="repo-card" key={repo.id}>
                    <h3>
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {repo.name}
                      </a>
                    </h3>

                    <p>
                      {repo.description || 'No description provided.'}
                    </p>
                    <p className="repo-updated">
  Updated: {new Date(repo.updated_at).toLocaleDateString()}
                    </p>
                    <div className="repo-meta">
                      <span>{repo.language || 'Not specified'}</span>
                      <span>⭐ {repo.stargazers_count}</span>
                    </div>  
                    <div className="repo-details">
                      <span>⑂ {repo.forks_count} Forks</span>

                      <span>👀 {repo.watchers_count} Watchers</span>

                      <span>🔧 {repo.open_issues_count} Open issues/PRs</span>
                    </div>

                  </article>
                ))}
              </div>
            )}
            {hasMore && (
            <div className="load-more-container">
              <button
                className="load-more-button"
                onClick={loadMoreRepositories}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Repositories'}
              </button>
            </div>
          )}
          </section>
        )}
       </main>
     </div>
  )
}

export default App
