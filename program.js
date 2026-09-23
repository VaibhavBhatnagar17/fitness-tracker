/* Program data: the 19-week plan, encoded.
   Start: Mon 21 Sep 2026.  Wedding: Tue 2 Feb 2027. */

const PROGRAM_START = '2026-09-21';
const WEDDING_DATE = '2027-02-02';
const FITTING_WEEK = 15;

const PROFILES = {
  mahak: { name: 'Mahak', accent: '#FF7E6B', accent2: '#FFB86B' },
  vaibhav: { name: 'Vaibhav', accent: '#5CC8FF', accent2: '#8B7CFF' },
};

const BLOCKS = [
  { n: 1, name: 'Rebuild', weeks: [1, 5], where: 'Bangalore',
    mission: 'Fix the bloodwork. Learn the lifts. Learn to swim. Maintenance calories.' },
  { n: 2, name: 'Hold', weeks: [6, 10], where: 'Udaipur · Diwali',
    mission: 'Do not lose ground. Three 30-minute sessions a week is the whole bar.' },
  { n: 3, name: 'Push', weeks: [11, 15], where: 'Bangalore',
    mission: 'The real block. Peak volume, deficit calories. Ends at the fitting.' },
  { n: 4, name: 'Polish', weeks: [16, 19], where: 'Udaipur',
    mission: 'Hold composition. Stay sharp. Taper into 2 February.' },
];

const TAPE_SITES = [
  { key: 'neck', label: 'Neck' },
  { key: 'chest', label: 'Chest / bust' },
  { key: 'underbust', label: 'Under-bust', only: 'mahak' },
  { key: 'waistNavel', label: 'Waist (navel)' },
  { key: 'waistNarrow', label: 'Waist (narrowest)' },
  { key: 'hips', label: 'Hips' },
  { key: 'arm', label: 'Upper arm' },
  { key: 'thigh', label: 'Thigh' },
];

/* ---- Warm-up / cool-down ------------------------------------------------ */

const WARMUP = {
  strength: [
    '3 min easy cardio — bike, rower, or brisk walk',
    'Leg swings front-to-back and side-to-side · 10 each',
    'Hip circles and deep bodyweight squats · 10',
    'Band pull-aparts and arm circles · 15',
    'Then 2 ramp-up sets of the first lift: ~50% and ~75% of the working weight',
  ],
  swim: [
    '5 min easy kicking with the board',
    'Shoulder circles and band pull-aparts on the deck · 15',
  ],
};

const COOLDOWN = [
  '3 min easy walk until your breathing settles',
  'Stretch what you trained — 30 s each side',
  'Legs: hip flexors, hamstrings, glutes · Upper: chest doorway, lats, triceps',
];

/* ---- Exercise library -------------------------------------------------- */
/* Every name here can be picked from the "add exercise" dropdown.
   Plan sessions below use the same names so history lines up. */

const LIBRARY = {
  Chest: ['Flat dumbbell press', 'Incline dumbbell press', 'Seated machine press', 'Bench press', 'Cable fly', 'Push-ups'],
  Back: ['Pull-ups', 'Cable pull-downs', 'Cable rowing', 'Barbell rowing', 'Dumbbell row', 'Deadlift', 'Lower back extension'],
  Shoulders: ['Dumbbell shoulder press', 'Lateral raises', 'Face pulls', 'Band face pulls', 'Rear delt fly'],
  Biceps: ['Dumbbell curls', 'Incline dumbbell curls', 'Cable curls', 'Concentration curls'],
  Triceps: ['Cable tricep push-down', 'Cable tricep extension', 'Skull crusher', 'Dumbbell overhead extension'],
  Legs: ['Barbell squat', 'Goblet squat', 'Sumo squat', 'Bodyweight squat', 'Leg press', 'Leg extension', 'Leg curl',
    'Romanian deadlift', 'Dumbbell Romanian deadlift', 'Lunges', 'Bulgarian split squat',
    'Seated calf raises', 'Standing calf raise', 'Single-leg calf raise'],
  Glutes: ['Hip thrust', 'Glute bridge', 'Single-leg glute bridge', 'Banded lateral walk', 'Cable glute kickback', 'Bridge pulse'],
  Core: ['Plank', 'Side plank', 'Reverse crunches', 'Bicycle twist', 'Leg scissors', 'Hanging leg raise', 'Cable crunch', 'Dead bug'],
};

/* Logged in seconds rather than kg × reps */
const TIMED = new Set(['Plank', 'Side plank']);

/* ---- Session library ---------------------------------------------------- */
/* sets: how many set rows to pre-fill.  reps: the target shown.
   flag: 'new' marks something that was not in your existing routine */

const ex = (name, sets, reps, note, flag) => ({ name, sets, reps, note: note || '', flag: flag || '' });
const scheme = it => it.sets ? `${it.sets} × ${it.reps}` : it.reps;

const SESSIONS = {

  /* ===== MAHAK — three full-body days, glute-biased ===== */

  M_A: { title: 'Full Body A', focus: 'Glutes & push', kind: 'strength', items: [
    ex('Hip thrust', 4, '10', 'Shoulders on a bench, chin tucked, one-second squeeze at the top. The single best exercise for the shape you asked for', 'new'),
    ex('Goblet squat', 3, '8', 'Conventional stance. Chest tall, sit between the knees. Move to the barbell once this feels easy'),
    ex('Incline dumbbell press', 3, '10', 'Bench at about 30°'),
    ex('Cable rowing', 3, '12', 'Pull to the belly button, squeeze the shoulder blades'),
    ex('Lateral raises', 3, '15', 'Light and slow. Shoulder width is what makes a waist look smaller', 'new'),
    ex('Reverse crunches', 3, '15'),
  ]},

  M_B: { title: 'Full Body B', focus: 'Hinge & pull', kind: 'strength', items: [
    ex('Romanian deadlift', 4, '10', 'The movement missing from your routine. Hips back, soft knees, weights slide down the thighs. Stop at the hamstring stretch', 'new'),
    ex('Bulgarian split squat', 3, '8 / leg', 'Rear foot on a bench. Hold the bench for balance at first. The best single-leg glute builder there is', 'new'),
    ex('Cable pull-downs', 3, '10', 'Builds toward your first pull-up'),
    ex('Flat dumbbell press', 3, '10'),
    ex('Banded lateral walk', 3, '15 steps / way', 'Glute medius — this is what creates the shelf and the hip-to-waist ratio', 'new'),
    ex('Bicycle twist', 3, '20 / side'),
  ]},

  M_C: { title: 'Full Body C', focus: 'Legs & arms', kind: 'strength', items: [
    ex('Sumo squat', 3, '10', 'Wide stance, toes out. Inner thigh and glute'),
    ex('Leg press', 3, '12', 'Feet high on the platform to bias glutes over quads'),
    ex('Leg curl', 3, '12', 'Hamstrings from the knee — your routine only trains them from the hip', 'new'),
    ex('Cable rowing', 3, '12'),
    ex('Dumbbell curls', 3, '12'),
    ex('Cable tricep push-down', 3, '12'),
    ex('Bridge pulse', 3, '20', 'Your existing finisher. Keep it'),
    ex('Leg scissors', 3, '20'),
  ]},

  M_D: { title: 'Full Body D', focus: 'Glute repeat', kind: 'strength', items: [
    ex('Hip thrust', 4, '12', 'Second dose of the week. Priority movement'),
    ex('Romanian deadlift', 3, '10'),
    ex('Lunges', 3, '10 / leg', 'Walking or reverse'),
    ex('Cable pull-downs', 3, '12'),
    ex('Lateral raises', 3, '15'),
    ex('Plank', 3, '45 s'),
    ex('Reverse crunches', 3, '15'),
  ]},

  /* ===== VAIBHAV — four-day upper/lower ===== */

  V_LA: { title: 'Lower A', focus: 'Squat strength', kind: 'strength', items: [
    ex('Barbell squat', 4, '5', 'Safety pins set. RPE 7 — three reps left in the tank'),
    ex('Romanian deadlift', 3, '8'),
    ex('Leg press', 3, '12'),
    ex('Leg curl', 3, '12', 'Missing from your routine. RDL trains hamstrings at the hip, this trains them at the knee — you need both', 'new'),
    ex('Seated calf raises', 4, '15'),
    ex('Hanging leg raise', 3, '12', 'Core work that does not thicken the waist', 'new'),
  ]},

  V_UA: { title: 'Upper A', focus: 'Push & pull strength', kind: 'strength', items: [
    ex('Flat dumbbell press', 4, '6', 'Heavy day. Spotter or safety bars'),
    ex('Barbell rowing', 4, '8', 'Torso around 45°. Your best thickness builder'),
    ex('Pull-ups', 4, '6', 'Add weight once you are past 8 clean reps'),
    ex('Seated machine press', 3, '10'),
    ex('Face pulls', 3, '15', 'The biggest hole in your routine. You press and do lateral raises but never train rear delts — that costs you posture, shoulder health, and the wide look from behind', 'new'),
    ex('Skull crusher', 3, '10'),
  ]},

  V_LB: { title: 'Lower B', focus: 'Hinge & volume', kind: 'strength', items: [
    ex('Deadlift', 3, '5', 'Start around 80–90 kg, not 140'),
    ex('Lunges', 3, '10 / leg', 'Walking'),
    ex('Leg extension', 3, '12'),
    ex('Lower back extension', 3, '12'),
    ex('Standing calf raise', 4, '15', 'You only do seated. Seated hits soleus, standing hits the gastrocnemius — the one you can actually see', 'new'),
    ex('Cable crunch', 3, '15'),
  ]},

  V_UB: { title: 'Upper B', focus: 'Arms & back width', kind: 'strength', items: [
    ex('Incline dumbbell press', 4, '10', 'Upper chest — what fills a sherwani'),
    ex('Cable pull-downs', 4, '12', 'Wide grip. Width'),
    ex('Cable rowing', 3, '12', 'Thickness'),
    ex('Lateral raises', 4, '15', 'Light, slow, high reps'),
    ex('Rear delt fly', 3, '15', 'Second rear-delt dose of the week', 'new'),
    ex('Incline dumbbell curls', 3, '10', 'Two bicep exercises here, not four. Spreading them across the week beats stacking them'),
    ex('Cable curls', 3, '12'),
    ex('Cable tricep push-down', 3, '12'),
    ex('Dumbbell overhead extension', 3, '12'),
  ]},

  /* ===== Home / travel — Udaipur (blocks 2 & 4) ===== */

  M_HOME: { title: 'Home Full Body', focus: 'Dumbbells & band', kind: 'strength', items: [
    ex('Goblet squat', 3, '12', 'Light weight, three-second lower, pause at the bottom'),
    ex('Dumbbell Romanian deadlift', 3, '12'),
    ex('Single-leg glute bridge', 3, '12 / side', 'Your hip thrust substitute when there is no bench'),
    ex('Dumbbell row', 3, '12'),
    ex('Push-ups', 3, '10', 'Hands on a bench or the bed if full push-ups are not there yet'),
    ex('Banded lateral walk', 3, '15 steps / way'),
    ex('Bridge pulse', 3, '20'),
    ex('Reverse crunches', 3, '20'),
  ]},

  V_HOME_L: { title: 'Home Lower', focus: '70 kg, higher reps', kind: 'strength', items: [
    ex('Barbell squat', 4, '8', 'Higher reps to make a lighter bar count'),
    ex('Romanian deadlift', 4, '10'),
    ex('Lunges', 3, '12 / leg'),
    ex('Single-leg calf raise', 3, '20'),
    ex('Lower back extension', 3, '15'),
  ]},

  V_HOME_U: { title: 'Home Upper', focus: 'Dumbbells & bar', kind: 'strength', items: [
    ex('Flat dumbbell press', 4, '8', 'Flat or floor'),
    ex('Barbell rowing', 4, '10'),
    ex('Dumbbell shoulder press', 3, '10'),
    ex('Band face pulls', 3, '15', 'Pack the band for this one'),
    ex('Dumbbell curls', 3, '12'),
    ex('Skull crusher', 3, '12'),
    ex('Push-ups', 2, 'max'),
  ]},

  MVS: { title: 'Bad-day version', focus: '20 minutes', kind: 'strength', items: [
    ex('Goblet squat', 3, '15', 'Bodyweight is fine'),
    ex('Push-ups', 3, '10', 'At any height'),
    ex('Dumbbell Romanian deadlift', 3, '12', 'Anything heavy works'),
    ex('Dumbbell row', 3, '15'),
    ex('Plank', 3, '45 s'),
    ex('Lunges', 3, '10 / leg'),
  ]},

  /* ===== Swim & recovery ===== */

  SWIM_1: { title: 'Swim', focus: 'Breathing & float', kind: 'swim', items: [
    ex('Kickboard lengths', 0, '10 min', 'Face in the water, exhaling through the nose the whole time'),
    ex('Bobbing', 0, '10 min', 'Exhale fully under, inhale at the surface. Until it is boring'),
    ex('Single-arm freestyle', 0, '10 min', 'Other hand on the board'),
  ]},
  SWIM_2: { title: 'Swim', focus: 'Putting it together', kind: 'swim', items: [
    ex('Easy warm-up', 0, '5 min'),
    ex('15 m freestyle repeats', 0, '8 × 15 m', '30 s rest. Clean technique beats distance'),
    ex('Kick and drill', 0, '10 min'),
    ex('Unbroken attempt', 0, '1 × 25 m'),
  ]},
  SWIM_3: { title: 'Swim', focus: 'Distance', kind: 'swim', items: [
    ex('Easy warm-up', 0, '5 min'),
    ex('Unbroken swims', 0, '4 × 25 m', 'Building toward 50 m unbroken'),
    ex('Drill work', 0, '10 min'),
  ]},

  ACTIVE: { title: 'Active day', focus: 'Optional', kind: 'active', optional: true, items: [] },
  REST: { title: 'Rest', focus: '', kind: 'rest', items: [] },
};

/* The strength sessions each person can pick from, in rotation order */
const SESSION_CHOICES = {
  mahak: { gym: ['M_A', 'M_B', 'M_C', 'M_D'], home: ['M_HOME'] },
  vaibhav: { gym: ['V_LA', 'V_UA', 'V_LB', 'V_UB'], home: ['V_HOME_L', 'V_HOME_U'] },
};

/* ---- Activities --------------------------------------------------------- */
/* fields: what gets logged for anything that is not a gym session */

const ACTIVITIES = {
  gym: { label: 'Gym', glyph: '◆' },
  swim: { label: 'Swim', glyph: '≈', fields: ['duration', 'unbroken', 'distanceM', 'note'] },
  badminton: { label: 'Badminton', glyph: '✦', fields: ['duration', 'intensity', 'note'],
    guide: { target: '45–60 min', points: [
      'Five minutes of easy rallying first — shoulders and ankles take the load',
      'Counts as your cardio for the day',
      'Water between games, not just at the end',
    ]}},
  cycling: { label: 'Cycling', glyph: '◎', fields: ['duration', 'distanceKm', 'intensity', 'note'],
    guide: { target: '45–60 min, conversational pace', points: [
      'You should be able to talk in full sentences. That pace burns fat without eating into your gym recovery',
      'Long and easy beats short and hard on a non-gym day',
    ]}},
  walk: { label: 'Walk / Hike', glyph: '▲', fields: ['duration', 'distanceKm', 'note'],
    guide: { target: '30–60 min', points: [
      'A 10–15 minute walk after a big meal flattens the blood-sugar spike',
      'Hikes are the best kind of "optional" — Udaipur in November is ideal for it',
    ]}},
  yoga: { label: 'Yoga / Mobility', glyph: '◌', fields: ['duration', 'note'],
    guide: { target: '20–40 min', points: [
      'Best the day after legs',
      'Hips, hamstrings, thoracic spine, shoulders',
      'No heated rooms',
    ]}},
  other: { label: 'Other', glyph: '+', fields: ['label', 'duration', 'intensity', 'note'],
    guide: { target: 'Anything that got you moving', points: [
      'Dance class, tennis, a long day on your feet at a function — log it, it counts',
    ]}},
};

const FIELD_DEFS = {
  duration: { label: 'Minutes', type: 'number', mode: 'numeric' },
  unbroken: { label: 'Longest unbroken (m)', type: 'number', mode: 'numeric' },
  distanceM: { label: 'Total distance (m)', type: 'number', mode: 'numeric' },
  distanceKm: { label: 'Distance (km)', type: 'number', mode: 'decimal' },
  label: { label: 'What was it?', type: 'text' },
  note: { label: 'Notes', type: 'text' },
};

const SWIM_GOAL = 50;

/* ---- Schedule ----------------------------------------------------------- */

function blockForWeek(week) {
  return BLOCKS.find(b => week >= b.weeks[0] && week <= b.weeks[1]) || BLOCKS[3];
}

/* dow: 0 = Sunday .. 6 = Saturday */
function sessionIdFor(profile, week, dow) {
  const block = blockForWeek(week).n;
  const home = block === 2 || block === 4;

  if (profile === 'mahak') {
    if (home) {
      if (dow === 1 || dow === 3 || dow === 5) return 'M_HOME';
      if (dow === 2 || dow === 4) return 'ACTIVE';
      return 'REST';
    }
    if (dow === 1) return 'M_A';
    if (dow === 3) return 'M_B';
    if (dow === 5) return 'M_C';
    if (dow === 2 || dow === 4) return swimFor(week);
    // Block 3 adds a fourth strength day
    if (dow === 6) return block === 3 ? 'M_D' : 'ACTIVE';
    return 'REST';
  }

  // vaibhav
  if (home) {
    const odd = week % 2 === 1;
    if (dow === 1 || dow === 5) return odd ? 'V_HOME_L' : 'V_HOME_U';
    if (dow === 3) return odd ? 'V_HOME_U' : 'V_HOME_L';
    if (dow === 2 || dow === 4) return 'ACTIVE';
    return 'REST';
  }
  if (dow === 1) return 'V_LA';
  if (dow === 3) return 'V_UA';
  if (dow === 5) return 'V_LB';
  if (dow === 6) return 'V_UB';
  if (dow === 2 || dow === 4) return swimFor(week);
  return 'REST';
}

function swimFor(week) {
  if (week <= 2) return 'SWIM_1';
  if (week <= 5) return 'SWIM_2';
  return 'SWIM_3';
}

const MILESTONES = {
  1: 'Book both doctors. Take tape measurements and photos. Review supplement doses.',
  4: 'October blood panel — before Udaipur. Add-on list is in your notes.',
  5: 'Mahak: 25 m unbroken. Vaibhav: back to ~85% of previous lifts.',
  6: 'Udaipur. The bar drops to three 30-minute sessions a week. Clear it.',
  10: 'Back from Diwali. Re-measure. The win was not losing ground.',
  11: 'Push block begins. This is the one that decides the fitting.',
  13: 'Second blood panel — your last chance to course-correct.',
  15: 'OUTFIT FITTING. Composition target date. Ease off the last three days.',
  16: 'Udaipur until the wedding. Hold, do not chase.',
  19: 'Taper. Two short sessions early, then stop. Walk. Sleep.',
};
