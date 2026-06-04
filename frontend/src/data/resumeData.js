export const profile = {
  name: 'Nguyen Manh Tuan Hung',
  title: 'Junior Full Stack Developer',
  location: 'Ho Chi Minh City, Vietnam',
  email: 'Henryparker0307@gmail.com',
  phone: '+84 XXX XXX XXX',
  github: 'https://github.com/HenryParker37-VIP',
  pastelChatRepository: 'https://github.com/HenryParker37-VIP/PASTEL_CHAT',
  linkedin: 'https://linkedin.com/in/add-linkedin-profile',
  availability: 'Available for Frontend Intern, Frontend Fresher, Full Stack Intern and Full Stack Fresher roles',
  summary:
    'Junior Full Stack Developer with practical experience building and deploying web applications using React.js, Node.js, MongoDB and AI-assisted workflows. Built a real-time messaging platform end to end, including authentication, data modeling, deployment and stability improvements.'
};

export const coreSkills = [
  'React.js UI Development',
  'Node.js and Express APIs',
  'MongoDB Schema Design',
  'JWT Authentication',
  'OAuth Integration',
  'Responsive UI Development',
  'Deployment and Debugging'
];

export const technicalSkills = [
  {
    label: 'Frontend',
    skills: ['React.js', 'JavaScript', 'HTML5', 'CSS3', 'Responsive Design']
  },
  {
    label: 'Backend',
    skills: ['Node.js', 'Express.js', 'REST APIs']
  },
  {
    label: 'Database',
    skills: ['MongoDB']
  },
  {
    label: 'Authentication',
    skills: ['JWT', 'Google OAuth', 'Microsoft OAuth']
  },
  {
    label: 'Deployment',
    skills: ['Vercel', 'Render']
  },
  {
    label: 'Tools',
    skills: ['Git', 'GitHub', 'Postman', 'ChatGPT', 'Gemini']
  }
];

export const project = {
  name: 'PastelChat',
  role: 'Full Stack Developer',
  timeline: '2024 - Present',
  productionBadge: 'Production Project',
  byline: 'Built and deployed by Nguyen Manh Tuan Hung',
  description:
    'Designed and deployed a real-time messaging platform supporting Google OAuth, Microsoft OAuth, custom accounts, avatar management, private conversations and group communication workflows.',
  recruiterSummary:
    'Owned frontend implementation, backend API delivery, authentication flows, MongoDB schema design, real-time communication, deployment, debugging and production maintenance.',
  techStack: [
    'React.js',
    'Node.js',
    'Express.js',
    'MongoDB',
    'Socket.io',
    'JWT',
    'Google OAuth',
    'Microsoft OAuth'
  ],
  liveDemoLabel: 'View Live Demo',
  liveDemoHref: 'https://pastel-chat.onrender.com/home',
  loginLabel: 'View Login Page',
  loginHref: 'https://pastel-chat.onrender.com/login',
  githubLabel: 'View GitHub Repository',
  githubHref: profile.pastelChatRepository,
  contributions: [
    'Built responsive React.js interfaces for login, onboarding, messaging and personal workspace flows.',
    'Developed Node.js and Express.js REST APIs for authentication, messaging and account management.',
    'Implemented Google OAuth, Microsoft OAuth and JWT authentication for production login flows.',
    'Designed MongoDB schema structures for users, conversations, group communication and personal space data.',
    'Integrated Socket.io for real-time private messaging and group chat updates.',
    'Deployed the frontend and backend to production and maintained the live environment.',
    'Debugged application issues and improved backend startup performance and service stability.',
    'Supported ongoing production maintenance across account registration, avatars and responsive usage.'
  ],
  screenshots: [
    {
      title: 'Login Screen',
      caption: 'Production login screen with Google OAuth, Microsoft account flow and custom account registration.',
      src: '/images/pastelchat-login.png',
      alt: 'PastelChat login screen'
    },
    {
      title: 'Dashboard Screen',
      caption: 'Live dashboard showing messaging entry points, group chat, media sharing, privacy tools and personal space access.',
      src: '/images/pastelchat-dashboard.png',
      alt: 'PastelChat dashboard screen'
    }
  ],
  phases: [
    'Planned the application structure, account model and authentication strategy.',
    'Built the React interface and Express API surface for messaging workflows.',
    'Connected MongoDB models, JWT flow, Google OAuth and Microsoft OAuth.',
    'Deployed the application and iterated on debugging, performance and stability.'
  ],
  evidence: [
    'Live production login and home routes are publicly accessible.',
    'Real screenshots are committed into the website assets and served by the application.',
    'The project demonstrates deployed OAuth flows, custom registration and responsive UI.',
    'The PastelChat source repository is publicly linked for recruiter verification.'
  ]
};

export const education = {
  institution: 'UTS College',
  period: '2023 - 2024',
  credential: 'Diploma of Information Technology',
  gpa: '3.1 / 4.0',
  ielts: '6.0',
  summary: 'Foundation in software development, database systems, web technologies and information systems.',
  focusAreas: [
    'Software Development',
    'Database Systems',
    'Web Technologies',
    'Information Systems'
  ],
  timeline: [
    '2023: Started Diploma of Information Technology at UTS College.',
    'Studied software development, database systems, web technologies and information systems.',
    '2024: Completed the diploma and achieved IELTS 6.0 alongside technical coursework.'
  ]
};

export const languages = [
  { name: 'Vietnamese', level: 'Native' },
  { name: 'English', level: 'IELTS 6.0' }
];

export const atsResume = {
  headline: 'Recruiter-first summary',
  lines: [
    'Junior Full Stack Developer focused on React.js, Node.js and MongoDB.',
    'Built and deployed PastelChat, a real-time messaging platform used as the featured production project.',
    'Hands-on with authentication, REST APIs, database design, real-time communication and deployment workflows.',
    'Available for Frontend Intern, Frontend Fresher, Full Stack Intern and Full Stack Fresher opportunities.'
  ],
  keywords: [
    'React.js',
    'Node.js',
    'Express.js',
    'MongoDB',
    'REST APIs',
    'JWT',
    'Google OAuth',
    'Microsoft OAuth',
    'Socket.io',
    'Responsive Design',
    'Vercel',
    'Render'
  ]
};

export const contactItems = [
  { label: 'Phone', value: profile.phone, href: 'tel:+84XXXXXXXXX' },
  { label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
  { label: 'GitHub', value: 'HenryParker37-VIP', href: profile.github },
  { label: 'LinkedIn', value: 'linkedin.com/in/add-linkedin-profile', href: profile.linkedin },
  { label: 'Location', value: profile.location, href: null },
  { label: 'Availability', value: profile.availability, href: null }
];
