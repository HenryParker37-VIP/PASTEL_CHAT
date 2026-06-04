import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResumePdfDocument, resumePdfFileName } from '../components/ResumePdfDocument';
import { atsResume, contactItems, coreSkills, education, languages, profile, project, technicalSkills } from '../data/resumeData';
import '../styles/resume.css';

const Resume = () => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  async function handleDownloadPdf() {
    try {
      setIsGeneratingPdf(true);
      const blob = await pdf(<ResumePdfDocument assetBaseUrl={window.location.origin} />).toBlob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = resumePdfFileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="resume-page-shell">
      <header className="resume-toolbar">
        <div>
          <p className="resume-toolbar-name">{profile.name}</p>
          <p className="resume-toolbar-sub">{profile.availability}</p>
        </div>
        <div className="resume-toolbar-actions">
          <a className="resume-toolbar-link" href="#featured-project">Featured Project</a>
          <a className="resume-toolbar-link" href="#technical-skills">Technical Skills</a>
          <a className="resume-toolbar-link" href="#education">Education</a>
          <button className="resume-toolbar-download" type="button" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? 'Preparing PDF' : 'Download PDF'}
          </button>
        </div>
      </header>

      <main className="resume-page-wrap">
        <article className="resume-sheet">
          <div className="resume-main-column">
            <section className="resume-header-block">
              <div className="resume-header-copy">
                <h1>{profile.name}</h1>
                <p className="resume-role">{profile.title}</p>
                <p className="resume-summary">{profile.summary}</p>
              </div>
              <div className="resume-availability-pill">{profile.availability}</div>
            </section>

            <section className="resume-contact-grid">
              {contactItems.map((item) => (
                item.href ? (
                  <a key={item.label} className="resume-contact-card" href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined}>
                    <span className="resume-contact-label">{item.label}</span>
                    <span className="resume-contact-value">{item.value}</span>
                  </a>
                ) : (
                  <div key={item.label} className="resume-contact-card">
                    <span className="resume-contact-label">{item.label}</span>
                    <span className="resume-contact-value">{item.value}</span>
                  </div>
                )
              ))}
            </section>

            <section id="featured-project" className="resume-section">
              <div className="resume-section-head">
                <span className="resume-proof-badge">{project.productionBadge}</span>
                <h2>{project.name}</h2>
                <p>{project.byline}</p>
              </div>
              <p className="resume-body-copy">{project.description}</p>
              <p className="resume-body-copy">{project.recruiterSummary}</p>
              <div className="resume-skill-chip-row">
                {project.techStack.map((tech) => (
                  <span key={tech} className="resume-skill-chip">{tech}</span>
                ))}
              </div>
              <div className="resume-proof-actions">
                <a className="resume-primary-button" href={project.liveDemoHref} target="_blank" rel="noreferrer">{project.liveDemoLabel}</a>
                <a className="resume-secondary-button" href={project.loginHref} target="_blank" rel="noreferrer">{project.loginLabel}</a>
                <a className="resume-secondary-button" href={project.githubHref} target="_blank" rel="noreferrer">{project.githubLabel}</a>
              </div>
              <div className="resume-proof-grid">
                <button type="button" className="resume-proof-image-card resume-proof-image-card-wide" onClick={() => setSelectedScreenshot(project.screenshots[1])}>
                  <div className="resume-proof-image-head">{project.screenshots[1].title}</div>
                  <img src={project.screenshots[1].src} alt={project.screenshots[1].alt} className="resume-proof-image" />
                </button>
                <button type="button" className="resume-proof-image-card" onClick={() => setSelectedScreenshot(project.screenshots[0])}>
                  <div className="resume-proof-image-head">{project.screenshots[0].title}</div>
                  <img src={project.screenshots[0].src} alt={project.screenshots[0].alt} className="resume-proof-image resume-proof-image-tall" />
                </button>
              </div>
              <div className="resume-evidence-box">
                <h3>Project Evidence</h3>
                {project.evidence.map((item) => (
                  <p key={item}>• {item}</p>
                ))}
              </div>
            </section>

            <section className="resume-section">
              <div className="resume-subhead">
                <h3>Core Skills</h3>
                <p>Profile understanding in under 15 seconds.</p>
              </div>
              <div className="resume-skill-chip-row">
                {coreSkills.map((skill) => (
                  <span key={skill} className="resume-neutral-chip">{skill}</span>
                ))}
              </div>
            </section>

            <section className="resume-section">
              <div className="resume-subhead">
                <h3>Project Experience</h3>
                <p>{project.timeline}</p>
              </div>
              <div className="resume-card-frame">
                <h4>{project.role}</h4>
                {project.contributions.map((item) => (
                  <p key={item} className="resume-list-row">• {item}</p>
                ))}
              </div>
              <div className="resume-card-frame">
                <h4>Project Timeline</h4>
                {project.phases.map((phase) => (
                  <p key={phase} className="resume-list-row">• {phase}</p>
                ))}
              </div>
            </section>

            <section id="education" className="resume-section">
              <div className="resume-subhead">
                <h3>Education</h3>
                <p>{education.period}</p>
              </div>
              <div className="resume-card-frame">
                <h4>{education.institution}</h4>
                <p className="resume-body-copy">{education.credential}</p>
                <p className="resume-body-copy">{education.summary}</p>
                <div className="resume-metric-grid">
                  <div className="resume-metric-card"><span>GPA</span><strong>{education.gpa}</strong></div>
                  <div className="resume-metric-card"><span>IELTS</span><strong>{education.ielts}</strong></div>
                </div>
                <div className="resume-skill-chip-row">
                  {education.focusAreas.map((area) => (
                    <span key={area} className="resume-neutral-chip">{area}</span>
                  ))}
                </div>
                <div className="resume-timeline-block">
                  {education.timeline.map((item) => (
                    <p key={item} className="resume-list-row">• {item}</p>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="resume-side-column">
            <section className="resume-section">
              <div className="resume-subhead">
                <h3>ATS Resume</h3>
                <p>Structured text summary for recruiter scanning.</p>
              </div>
              <div className="resume-card-frame resume-muted-card">
                <p className="resume-card-kicker">{atsResume.headline}</p>
                {atsResume.lines.map((line) => (
                  <p key={line} className="resume-list-row">• {line}</p>
                ))}
                <div className="resume-skill-chip-row">
                  {atsResume.keywords.map((keyword) => (
                    <span key={keyword} className="resume-keyword-chip">{keyword}</span>
                  ))}
                </div>
              </div>
            </section>

            <section id="technical-skills" className="resume-section">
              <div className="resume-subhead">
                <h3>Technical Skills</h3>
                <p>Grouped for fast recruiter review.</p>
              </div>
              <div className="resume-technical-grid">
                {technicalSkills.map((group) => (
                  <div key={group.label} className="resume-card-frame">
                    <h4>{group.label}</h4>
                    <p className="resume-body-copy">{group.skills.join(', ')}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="resume-section">
              <div className="resume-subhead">
                <h3>Languages</h3>
                <p>Communication readiness.</p>
              </div>
              <div className="resume-technical-grid">
                {languages.map((language) => (
                  <div key={language.name} className="resume-card-frame">
                    <h4>{language.name}</h4>
                    <p className="resume-body-copy">{language.level}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="resume-section">
              <div className="resume-subhead">
                <h3>Quick Actions</h3>
                <p>Direct recruiter contact paths.</p>
              </div>
              <div className="resume-quick-actions">
                <a className="resume-primary-button" href={`mailto:${profile.email}`}>Email</a>
                <a className="resume-secondary-button" href={project.githubHref} target="_blank" rel="noreferrer">GitHub Repository</a>
                <a className="resume-secondary-button" href={project.liveDemoHref} target="_blank" rel="noreferrer">Live Demo</a>
              </div>
            </section>
          </aside>
        </article>
      </main>

      {selectedScreenshot ? (
        <div className="resume-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSelectedScreenshot(null)}>
          <div className="resume-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="resume-modal-head">
              <div>
                <p>{selectedScreenshot.title}</p>
                <span>{selectedScreenshot.caption}</span>
              </div>
              <button type="button" onClick={() => setSelectedScreenshot(null)}>Close</button>
            </div>
            <div className="resume-modal-media">
              <img src={selectedScreenshot.src} alt={selectedScreenshot.alt} className="resume-modal-image" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Resume;
