import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useLang } from '../i18n';
import PastelIcon from '../components/PastelIcon';

const ReleaseSection = ({ icon, title, items, tone }) => {
  if (!items?.length) return null;
  return (
    <section className={`release-section release-section--${tone}`}>
      <div className="release-section-heading"><PastelIcon name={icon} size={17} /><h3>{title}</h3></div>
      <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
    </section>
  );
};

const ReleaseCard = ({ release, onOpen, t, lang, featured = false }) => {
  const localized = (vi, fallback) => lang === 'vi' && vi?.length ? vi : fallback;
  return (
  <article className={`release-card ${featured ? 'release-card--featured' : ''}`}>
    <div className="release-card-heading">
      <div>
        <p className="release-version">PastelChat v{release.version}</p>
        <h2>{localized(release.titleVi, release.title)}</h2>
      </div>
      {release.important && <span className="release-important"><PastelIcon name="sparkles" size={13} /> {t('releaseImportant')}</span>}
    </div>
    {release.summary && <p className="release-summary">{lang === 'vi' ? (release.summaryVi || release.summary) : release.summary}</p>}
    <div className="release-sections">
      <ReleaseSection icon="sparkles" title={t('releaseFeatures')} items={localized(release.featuresVi, release.features)} tone="features" />
      <ReleaseSection icon="check" title={t('releaseFixes')} items={localized(release.fixesVi, release.fixes)} tone="fixes" />
      <ReleaseSection icon="palette" title={t('releaseImprovements')} items={localized(release.improvementsVi, release.improvements)} tone="improvements" />
    </div>
    <div className="release-card-footer">
      <time dateTime={release.releasedAt}>{new Date(release.releasedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
      {!featured && <button type="button" className="btn btn-ghost" onClick={() => onOpen(release.version)}>{t('releaseViewDetails')}</button>}
    </div>
  </article>
  );
};

const ReleaseNotes = () => {
  const { version } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/releases')
      .then(({ data }) => { if (active) setReleases(data.releases || []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (version) api.post(`/releases/${encodeURIComponent(version)}/seen`).catch(() => {});
  }, [version]);

  const selected = version ? releases.find(release => release.version === version) : null;

  return (
    <div className="container release-notes-page">
      <button type="button" className="btn btn-ghost release-back" onClick={() => navigate('/home')}>
        <PastelIcon name="arrow-left" size={16} /> {t('back')}
      </button>
      <header className="release-notes-header">
        <div className="release-notes-mark"><PastelIcon name="sparkles" size={25} /></div>
        <div><h1>{t('releaseTitle')}</h1><p>{t('releaseDescription')}</p></div>
      </header>
      {loading && <div className="card release-empty">{t('loading')}</div>}
      {!loading && error && <div className="card release-empty release-empty--error">{t('releaseLoadError')}</div>}
      {!loading && !error && selected && <ReleaseCard release={selected} t={t} lang={lang} featured />}
      {!loading && !error && !selected && (
        <div className="release-history">
          {releases.length ? releases.map((release, index) => <ReleaseCard key={release._id || release.version} release={release} t={t} lang={lang} featured={index === 0} onOpen={(nextVersion) => navigate(`/whats-new/${encodeURIComponent(nextVersion)}`)} />) : <div className="card release-empty">{t('releaseEmpty')}</div>}
        </div>
      )}
    </div>
  );
};

export default ReleaseNotes;
