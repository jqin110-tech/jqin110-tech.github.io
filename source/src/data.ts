// All resume content lives here. Both the game and the plain resume view
// render from this one file, so editing it updates everything.

export interface Link {
  label: string;
  url: string;
}

export interface Project {
  name: string;
  dates: string;
  tagline: string;
  stack: string[];
  bullets: string[];
  links?: Link[];
  /** false keeps the project off the one-page paper resumes. It still has its room, its picture and its links on the site. */
  paper?: boolean;
}

export interface Role {
  title: string;
  org: string;
  dates: string;
  bullets: string[];
}

export const resume = {
  name: 'Joshua Qin',
  headline: 'Honours Mathematics (Co-op) · University of Waterloo',
  location: 'Vancouver, BC',
  email: 'jqin110@gmail.com',
  links: [{ label: 'GitHub', url: 'https://github.com/jqin110-tech' }] as Link[],
  summary:
    'First-year Honours Mathematics student at Waterloo. I build data tools and simulations in Python and check them against real data. Looking for a software engineering co-op or internship.',

  /** About me. Every fact here comes from Joshua's own notes (2026-11-12); do not add to it without asking him. */
  about: {
    hello: 'Hi, I’m Joshua.',
    paras: [
      'I grew up in Vancouver and did a lot of backpacking in the backcountry. My favourite part was spending nights in the snow, high up in the mountains. There’s a lot less of that in Waterloo.',
      'I study math because it sits underneath almost everything. It’s how we describe the world, and I want to learn as much of it as I can and point it at as many different problems as I can find. Coding is what made that feel real. Ever since I saw how much you can build with it, I haven’t really stopped.',
      'In my own time I read and watch a lot about modern physics, mostly astrophysics, which is probably how this site ended up as a galaxy. I used to play more games and watch shows like Suits, but since university started, that time goes into projects instead.',
    ],
    photo: { label: 'Missing', text: 'Backpacking in Whistler, winter', alt: 'Joshua standing on a snowy trail between dark fir trees, with a mountain range behind him' },
    /** Pictures are keyed to files in src/assets (see cv.ts). A picture with no file yet shows its name in an empty frame. */
    offClock: [
      {
        label: 'Listening to',
        text: 'Men I Trust, Ultra Naté, Beach House, Baby Smoove',
        imgs: [
          { key: 'untourable', alt: 'Cover of Untourable Album by Men I Trust', name: 'Untourable Album' },
          { key: 'free', alt: 'Cover of Free by Ultra Naté', name: 'Free' },
          { key: 'devotion', alt: 'Cover of Devotion by Beach House', name: 'Devotion' },
        ],
      },
      { label: 'Watching', text: 'UFC', imgs: [] },
      { label: 'Learning from', text: 'Brian Cox’s videos on astrophysics', imgs: [] },
    ] as { label: string; text: string; imgs: { key: string; alt: string; name: string }[] }[],
    /** Credits for any free-licence photos; none are in use (Joshua chose text over photos of other people, 2026-11-12). */
    credits: [] as { text: string; url: string }[],
  },

  education: {
    school: 'University of Waterloo',
    program: 'Honours Mathematics, Co-op',
    dates: '2026 – 2031',
    grad: 'April 2031',
    details: ['Expected graduation April 2031.'],
  },

  projects: [
    {
      name: 'Gravity Simulator',
      dates: 'Nov 2026',
      tagline: 'Newtonian N-body simulator, from the real solar system to a 100,000-body galaxy collision.',
      stack: ['Python', 'NumPy', 'Numba', 'pytest'],
      links: [
        { label: 'Live demo', url: 'https://jqin110-tech.github.io/nbody-gravity-simulator/' },
        { label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/nbody-gravity-simulator' },
      ],
      bullets: [
        'Built an N-body simulator (Euler, leapfrog, RK4) and verified it on exact Kepler orbits: period error 1.1e-6, every integrator at its expected order.',
        'Ran the real solar system for 200 years from NASA JPL data: all eight planets’ periods match NASA’s sidereal values within 1.4e-4.',
        'Profiled, then compiled a Barnes-Hut octree with Numba for a 131–210× speed-up; it overtakes the exact direct sum from 4,096 bodies up.',
        'Simulated a 100,000-body galaxy collision with 0.27% energy drift, backed by 46 pytest tests and a live demo that runs in the browser.',
      ],
    },
    {
      name: 'Tickerchatter',
      dates: 'Jun – Nov 2026',
      tagline: 'Live site that flags stocks whose news coverage suddenly breaks from normal.',
      stack: ['Python', 'Statistics', 'pytest', 'GitHub Actions'],
      links: [
        { label: 'Live site', url: 'https://jqin110-tech.github.io/tickerchatter/' },
        { label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/tickerchatter' },
      ],
      bullets: [
        'Built an ingestion → aggregation → detection pipeline that collects headlines for 40 large-cap stocks from public news feeds (Google News, Yahoo Finance), skips duplicates, and counts mentions per ticker per day.',
        'Detected anomalies with z-scores against each ticker’s own 14-day baseline, comparing today so far with the same hours of earlier days, so rarely covered stocks surface on unusual activity rather than raw volume.',
        'Traced a bug that flagged 28 of 40 stocks as spikes to a 100-result search cap, resampled every day the same way and cut it to 6 of 40, with a regression test (steady stock: z ≈ 5 → 0).',
        'Automated it end to end: an hourly GitHub Actions job runs 69 pytest tests, then re-runs the pipeline and republishes the site only if they pass.',
        'Wrote, but have not switched on yet, a live search for any company: a Cloudflare Worker fetches 15 days of headlines and the same Python scoring code runs in the visitor’s browser through Pyodide. Until then, searches cover the 40 tracked stocks.',
      ],
    },
    {
      name: 'Brain Oxygen Model',
      dates: 'Nov 2026',
      tagline: 'One-equation model of the brain’s oxygen store that predicts how fast a blood choke causes unconsciousness, tested against published measurements.',
      stack: ['Python', 'NumPy', 'SciPy', 'matplotlib', 'pytest'],
      paper: false,
      links: [{ label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/blood-choke-model' }],
      bullets: [
        'Modelled the oxygen in the blood inside the brain as one differential equation (arterial supply, venous loss, Michaelis-Menten consumption) and solved it with SciPy, with each parameter traced to a cited paper or flagged as unsourced, and 15 written assumptions.',
        'Fitted the one unknown, the oxygen level at which consciousness is lost, to a 1943 cuff study, then tested on data the fit never saw: 8.6 s or 11.3 s, depending on how the lab’s flow measurement is read, against 9.0 s (95% CI 8.3–9.9) timed in 81 UFC chokes.',
        'Ran a 20,000-draw Monte Carlo over the sourced ranges: median 8.7 s (5–95%: 5.1 to 16.2 s), and no loss of consciousness at all in 26.6% of draws, which shows how loosely one study pins the threshold down.',
        'Reported a test the model fails: it predicts waking 0.2 to 1.0 s after release against 3 to 11.5 s observed, and no sourced parameter values close the gap.',
        'Covered it with 80 pytest tests on GitHub Actions, including one that checks the JavaScript copy of the equation in the browser simulator against the Python model.',
        'Built with Claude Code, which read the sources and wrote most of the code under my rules; I set the question, chose how to handle the missing threshold and approved each stage. Educational model, not medical advice.',
      ],
    },
    {
      name: 'Backtester',
      dates: 'Aug – Nov 2026',
      tagline: 'Research backtester that tests a trading rule and an ML model honestly.',
      stack: ['Python', 'pandas', 'scikit-learn', 'pytest', 'matplotlib'],
      links: [{ label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/backtester' }],
      bullets: [
        'Diagnosed results that beat the market by too much: the strategy was trading on the same bar that generated its signal. Fixed the lookahead bias by lagging signals one bar.',
        'Rebuilt the script as a vectorized pandas package with a CLI and 28 pytest tests, reporting Sharpe ratio, max drawdown and returns net of costs, in-sample and out-of-sample.',
        'Showed that tuning overfits: the in-sample-best of 41 moving-average pairs ranked 26th–36th of 41 out-of-sample on all 4 stocks (rank correlation −0.11 to −0.59).',
        'Validated a random-forest volatility classifier with purged 5-fold walk-forward testing: it beat the majority baseline by 5–9 points but lost to a one-line volatility rule in 12 of 15 folds.',
        'Wrote a leakage test that recomputes every feature with future data removed and fails on any change, checked by planting a deliberate lookahead feature.',
      ],
    },
    {
      name: 'Resume Quest',
      dates: 'Nov 2026',
      tagline: 'This site: an explorable galaxy with the full resume below it.',
      stack: ['TypeScript', 'Canvas 2D', 'Vite'],
      // the code link only exists where the site is served from its own repository
      links: __HOSTED__ ? [{ label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/jqin110-tech.github.io' }] : undefined,
      bullets: [
        'Designed and directed an explorable galaxy resume: set the concept, look and interactions, and tested every build across 40+ versions.',
        'Placed sections along a logarithmic (golden) spiral with equal arc-length spacing, derived from r = R₀·φ^(−2θ/π).',
        'Runs as one static page drawn on Canvas 2D with no game engine, with keyboard, touch and reduced-motion support.',
        'Built with Claude Code, which wrote the TypeScript; I wrote the specs, made the design decisions and reviewed every build.',
      ],
    },
    {
      name: 'Banking System',
      dates: 'May – Aug 2026',
      tagline: 'Command-line banking app with persistent transaction history.',
      stack: ['Python', 'OOP', 'unittest'],
      paper: false,
      links: [{ label: 'Code on GitHub', url: 'https://github.com/jqin110-tech/banking-system' }],
      bullets: [
        'Designed separate model, service, storage and CLI layers so business rules never touch I/O.',
        'Wrote 17 unit tests (all passing), using dependency injection and an in-memory fake store to test the service layer in isolation.',
      ],
    },
  ] as Project[],

  experience: [
    {
      title: 'Robotics Instructor',
      org: 'UTG Academy',
      dates: 'Sep 2024 – Apr 2025',
      bullets: [
        'Taught a weekly class of 12 students covering VEX mechanics and programming fundamentals.',
        'Coached students through a VEX competition challenge from design to build and iteration.',
      ],
    },
    {
      title: 'Student Volunteer',
      org: 'Dunbar Community Centre Association',
      dates: 'Sep 2024 – Jun 2026',
      bullets: ['Supported newly arrived Chinese families in Mandarin and Cantonese at community programs and events.'],
    },
    {
      title: 'Sergeant, Section Commander',
      org: 'Royal Canadian Army Cadets',
      dates: 'Feb 2024 – Jun 2026',
      bullets: ['Led a section of 10 junior cadets through training, drill and personal development.'],
    },
  ] as Role[],

  curiosity: [
    ['Low-volume tickers', 'Counts like 0, 0, 1 looked like huge spikes, so I put a floor under the standard deviation and required a minimum history before scoring.'],
    ['A model that learned nothing', 'My first price-direction model tied the “always guess up” baseline, so I switched to predicting volatility, which actually clusters.'],
    ['Results that looked too good', 'An early backtest beat the market by too much. The cause was lookahead bias.'],
    ['How browsers draw', 'Device pixel ratio, compositing and requestAnimationFrame, learned while building this site.'],
  ] as [string, string][],

  skills: {
    Languages: ['Python', 'Java', 'Racket', 'TypeScript'],
    'Libraries & tools': ['pandas', 'NumPy', 'Numba', 'scikit-learn', 'matplotlib', 'pytest', 'unittest', 'GitHub Actions', 'Canvas 2D', 'VS Code'],
    Spoken: ['English', 'Mandarin', 'Cantonese'],
  } as Record<string, string[]>,
};

export type Resume = typeof resume;

// Strengths a visitor discovers as they visit planets.
export const criteria = [
  { id: 'grad', label: 'Math at Waterloo, graduating 2031' },
  { id: 'webmobile', label: 'Builds for the web' },
  { id: 'project', label: 'Ships real projects' },
  { id: 'starter', label: 'Self-starter' },
  { id: 'curious', label: 'Curious problem-solver' },
  { id: 'quality', label: 'Writes quality code' },
  { id: 'design', label: 'Eye for design' },
] as const;

export type CriterionId = (typeof criteria)[number]['id'];

// One line of evidence per strength, shown in the "At a glance" table.
export const fit: Record<CriterionId, string> = {
  grad: 'Graduating April 2031 (Honours Mathematics Co-op, University of Waterloo).',
  webmobile: 'This site, a web app drawn on Canvas 2D.',
  project: 'Resume Quest, a browser game built for the web.',
  starter: 'Six self-directed projects in 2026, each built outside of class.',
  curious: 'Traced lookahead bias in my backtester; rethought z-scores for low-volume tickers.',
  quality: '240 automated tests across five projects; modular, layered code.',
  design: 'Background in visual art; art-directed this site’s galaxy, planets and interface.',
};
