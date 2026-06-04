import React from 'react';
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { atsResume, contactItems, coreSkills, education, languages, profile, project, technicalSkills } from '../data/resumeData';

export const resumePdfFileName = 'Nguyen-Manh-Tuan-Hung-Resume.pdf';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#171717',
    fontFamily: 'Helvetica',
    fontSize: 9.6,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    lineHeight: 1.45
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    borderBottom: '1 solid #d4d4d4',
    paddingBottom: 14
  },
  titleBlock: {
    width: '62%'
  },
  headerName: {
    fontSize: 23,
    fontWeight: 700
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    marginTop: 4
  },
  headerSummary: {
    marginTop: 8
  },
  contactBlock: {
    width: '38%'
  },
  contactRow: {
    marginBottom: 3
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 7,
    borderBottom: '1 solid #d4d4d4',
    paddingBottom: 4
  },
  body: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 14
  },
  leftCol: {
    width: '64%'
  },
  rightCol: {
    width: '36%'
  },
  section: {
    marginBottom: 12
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5
  },
  chip: {
    border: '1 solid #d4d4d4',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8.5
  },
  listItem: {
    marginBottom: 4
  },
  projectShotGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  projectShot: {
    flex: 1,
    border: '1 solid #d4d4d4',
    borderRadius: 4,
    padding: 7,
    minHeight: 84
  },
  shotHeader: {
    fontSize: 8.8,
    fontWeight: 700,
    marginBottom: 5
  },
  imageFrame: {
    border: '1 solid #d4d4d4',
    borderRadius: 4,
    overflow: 'hidden',
    height: 84
  },
  shotImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  shotCaption: {
    marginTop: 3,
    fontSize: 8.2
  },
  keywordBox: {
    border: '1 solid #d4d4d4',
    borderRadius: 4,
    padding: 8
  }
});

export function ResumePdfDocument({ assetBaseUrl = '' }) {
  return (
    <Document title={`${profile.name} Resume`} author={profile.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.headerName}>{profile.name}</Text>
            <Text style={styles.headerTitle}>{profile.title}</Text>
            <Text style={styles.headerSummary}>{profile.summary}</Text>
          </View>

          <View style={styles.contactBlock}>
            {contactItems.map((item) => (
              <Text key={item.label} style={styles.contactRow}>
                <Text style={{ fontWeight: 700 }}>{item.label}: </Text>
                {item.href ? <Link src={item.href}>{item.value}</Link> : item.value}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.leftCol}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Core Skills</Text>
              <View style={styles.chips}>
                {coreSkills.map((skill) => (
                  <Text key={skill} style={styles.chip}>{skill}</Text>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Experience</Text>
              <Text style={{ fontWeight: 700 }}>{project.name}</Text>
              <Text>{project.timeline}</Text>
              <Text style={{ fontWeight: 700, marginTop: 4 }}>{project.role}</Text>
              <Text style={{ marginTop: 4 }}>{project.description}</Text>
              <Text style={{ marginTop: 4 }}>{project.recruiterSummary}</Text>
              <Text style={{ marginTop: 6, fontWeight: 700 }}>Production Proof</Text>
              <Text style={styles.listItem}>
                <Text style={{ fontWeight: 700 }}>Live Demo: </Text>
                <Link src={project.liveDemoHref}>{project.liveDemoHref}</Link>
              </Text>
              <Text style={styles.listItem}>
                <Text style={{ fontWeight: 700 }}>Login Page: </Text>
                <Link src={project.loginHref}>{project.loginHref}</Link>
              </Text>
              <Text style={styles.listItem}>
                <Text style={{ fontWeight: 700 }}>GitHub: </Text>
                <Link src={project.githubHref}>{project.githubHref}</Link>
              </Text>
              {project.contributions.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
              <View style={styles.projectShotGrid}>
                {project.screenshots.map((shot) => (
                  <View key={shot.title} style={styles.projectShot}>
                    <Text style={styles.shotHeader}>{shot.title}</Text>
                    <View style={styles.imageFrame}>
                      <Image src={`${assetBaseUrl}${shot.src}`} style={styles.shotImage} />
                    </View>
                    <Text style={styles.shotCaption}>{shot.caption}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Timeline</Text>
              {project.phases.map((phase) => (
                <Text key={phase} style={styles.listItem}>• {phase}</Text>
              ))}
              <Text style={{ marginTop: 4, fontWeight: 700 }}>Project Evidence</Text>
              {project.evidence.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Education</Text>
              <Text style={{ fontWeight: 700 }}>{education.institution}</Text>
              <Text>{education.period}</Text>
              <Text>{education.credential}</Text>
              <Text>GPA: {education.gpa}</Text>
              <Text>IELTS: {education.ielts}</Text>
              <Text style={{ marginTop: 4 }}>{education.summary}</Text>
              <Text style={{ marginTop: 4, fontWeight: 700 }}>Education Timeline</Text>
              {education.timeline.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ATS Resume</Text>
              <View style={styles.keywordBox}>
                {atsResume.lines.map((line) => (
                  <Text key={line} style={styles.listItem}>• {line}</Text>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Technical Skills</Text>
              {technicalSkills.map((group) => (
                <Text key={group.label} style={styles.listItem}>
                  <Text style={{ fontWeight: 700 }}>{group.label}: </Text>
                  {group.skills.join(', ')}
                </Text>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Keywords</Text>
              <View style={styles.chips}>
                {atsResume.keywords.map((keyword) => (
                  <Text key={keyword} style={styles.chip}>{keyword}</Text>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Languages</Text>
              {languages.map((language) => (
                <Text key={language.name} style={styles.listItem}>
                  <Text style={{ fontWeight: 700 }}>{language.name}: </Text>
                  {language.level}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
