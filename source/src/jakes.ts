// The one-page resume in the Jake's Resume layout, shown as the quick resume.
// This is the same text as the LaTeX resume (Joshua-Qin-Resume-Jakes.tex). Change both together.
import { resume } from './data';

export const jakes = {
  name: resume.name,
  contact: [
    { label: resume.email, url: `mailto:${resume.email}` },
    { label: 'github.com/jqin110-tech', url: 'https://github.com/jqin110-tech' },
    { label: 'jqin110-tech.github.io/tickerchatter', url: 'https://jqin110-tech.github.io/tickerchatter/' },
  ],
  education: [{ school: 'University of Waterloo', place: 'Waterloo, ON', degree: 'Honours Mathematics, Co-op', dates: '2026 – Expected Apr. 2031' }],
  projects: [
    {
      name: 'Tickerchatter',
      url: 'https://jqin110-tech.github.io/tickerchatter/',
      stack: 'Python, pytest, GitHub Actions',
      dates: 'Jun. 2026 – Nov. 2026',
      items: [
        'Built a live website that shows which of 40 large stocks are getting unusually heavy news coverage today',
        'Scored each stock against its own 14-day history, so a quiet stock with a sudden burst of news stands out',
        'Traced a bug that flagged 28 of 40 stocks to a search limit and fixed it, cutting the number flagged to 6',
        'Automated it with GitHub Actions: it runs every hour, and the site only updates after all 69 tests pass',
      ],
    },
    {
      name: 'Backtester',
      url: 'https://github.com/jqin110-tech/backtester',
      stack: 'Python, pandas, scikit-learn, pytest, matplotlib',
      dates: 'Aug. 2026 – Nov. 2026',
      items: [
        'Built a tool that tests stock-trading strategies on years of past prices, backed by 28 automated tests',
        'Caught a bug that made results look too good: the strategy was trading on information it could not have had yet',
        'Showed that the best settings on past data were mostly luck: they ranked 26th to 36th of 41 on new data',
        'Tested a machine-learning model on data it had never seen; it lost to a one-line rule in 12 of 15 test periods',
      ],
    },
    {
      name: 'Gravity Simulator',
      url: 'https://jqin110-tech.github.io/nbody-gravity-simulator/',
      stack: 'Python, NumPy, Numba, pytest',
      dates: 'Nov. 2026',
      items: [
        'Built a gravity simulator and checked it against NASA data: all eight planets’ orbit times match within 0.014%',
        'Made it over 100 times faster with Numba, enough to simulate two galaxies colliding with 100,000 bodies',
      ],
    },
    {
      name: 'Resume Quest',
      url: '',
      stack: 'TypeScript, Canvas 2D, Vite',
      dates: 'Nov. 2026',
      items: [
        'Designed and directed my portfolio site: a galaxy you can fly through, with my resume and project demos below it',
        'Built with Claude Code, which wrote the TypeScript; I wrote the specs and tested every build',
      ],
    },
  ],
  experience: [
    {
      title: 'Robotics Instructor',
      dates: 'Sep. 2024 – Apr. 2025',
      org: 'UTG Academy',
      items: [
        'Taught a weekly class of 12 students the basics of building and programming VEX robots',
        'Coached students through a VEX competition challenge, from the first design to building and improving it',
      ],
    },
    {
      title: 'Sergeant, Section Commander',
      dates: 'Feb. 2024 – Jun. 2026',
      org: 'Royal Canadian Army Cadets',
      items: ['Led a section of 10 junior cadets through training, drill and personal development'],
    },
    {
      title: 'Student Volunteer',
      dates: 'Sep. 2024 – Jun. 2026',
      org: 'Dunbar Community Centre Association',
      items: ['Supported newly arrived Chinese families in Mandarin and Cantonese at community programs and events'],
    },
  ],
  skills: [
    ['Languages', 'Python, Java, Racket; familiar with TypeScript'],
    ['Libraries', 'pandas, NumPy, Numba, scikit-learn, matplotlib, pytest, unittest, Canvas 2D'],
    ['Developer Tools', 'Git, VS Code, GitHub Actions'],
    ['Spoken Languages', 'English, Mandarin, Cantonese'],
  ],
} as const;
