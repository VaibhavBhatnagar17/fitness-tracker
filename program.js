/* Program data: the 19-week plan, encoded.
   Start: Mon 21 Sep 2026.  Wedding: Tue 2 Feb 2027. */

const PROGRAM_START = '2026-09-21';
const WEDDING_DATE = '2027-02-02';
const FITTING_WEEK = 15;

const PROFILES = {
  mahak: { name: 'Mahak', colour: '#e8896b' },
  vaibhav: { name: 'Vaibhav', colour: '#6b9ae8' },
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

/* ---- Session library ---------------------------------------------------- */

const ex = (name, scheme, note) => ({ name, scheme, note: note || '' });

const SESSIONS = {
  /* --- Mahak, gym (blocks 1 & 3) --- */
  M_A: { title: 'Full Body A', kind: 'strength', items: [
    ex('Goblet squat', '3 × 8–10', 'Chest tall, sit between the knees'),
    ex('Dumbbell Romanian deadlift', '3 × 10', 'Hips back, soft knees. Stop at the hamstring stretch'),
    ex('Incline dumbbell press', '3 × 10', 'Bench at about 30°'),
    ex('Seated cable row', '3 × 12', 'Pull to the belly button'),
    ex('Glute bridge / hip thrust', '3 × 12', 'One-second pause at the top'),
    ex('Plank', '3 × 30–45 s', 'Ribs down, glutes tight'),
  ]},
  M_B: { title: 'Full Body B', kind: 'strength', items: [
    ex('Hip thrust', '3 × 10', 'Your highest-return lift. Chin tucked'),
    ex('Bulgarian split squat', '3 × 8 / leg', 'Hold the bench for balance at first'),
    ex('Lat pulldown', '3 × 10', 'Builds toward your first pull-up'),
    ex('Dumbbell shoulder press', '3 × 10', 'Seated, back supported'),
    ex('Cable or band glute kickback', '3 × 15 / side', ''),
    ex('Dead bug', '3 × 10 / side', 'Lower back flat throughout'),
  ]},
  M_C: { title: 'Full Body C', kind: 'strength', items: [
    ex('Trap-bar or dumbbell deadlift', '3 × 8', 'Same hinge as the RDL, from the floor'),
    ex('Leg press', '3 × 12', 'Feet high on the platform for glutes'),
    ex('Push-up progression', '3 × max', 'Hands on a bench → lower surface → knees → full'),
    ex('Band-assisted pull-up', '3 × 5', 'Or lat pulldown'),
    ex('Cable lateral raise', '2 × 15', 'Shoulder width makes the waist look smaller'),
    ex('Side plank', '3 × 20–30 s / side', ''),
  ]},

  /* --- Vaibhav, gym (blocks 1 & 3) --- */
  V_LA: { title: 'Lower A — strength', kind: 'strength', items: [
    ex('Back squat', '4 × 5', 'Safety pins set. RPE 7'),
    ex('Romanian deadlift', '3 × 8', ''),
    ex('Leg press', '3 × 12', ''),
    ex('Standing calf raise', '4 × 15', ''),
    ex('Hanging leg raise', '3 × 12', 'Waist work that does not thicken the waist'),
  ]},
  V_UA: { title: 'Upper A — strength', kind: 'strength', items: [
    ex('Bench press', '4 × 6', 'Spotter or safety bars'),
    ex('Pull-up', '4 × 6', 'Add weight past 8 clean reps'),
    ex('Overhead press', '3 × 8', ''),
    ex('Barbell row', '3 × 8', 'Torso around 45°. Your best width builder'),
    ex('Barbell curl + rope triceps', '3 × 12 each', ''),
  ]},
  V_LB: { title: 'Lower B — volume', kind: 'strength', items: [
    ex('Deadlift', '3 × 5', 'Start around 80–90 kg, not 140'),
    ex('Bulgarian split squat', '3 × 10 / leg', ''),
    ex('Leg curl', '3 × 12', ''),
    ex('Hip thrust', '3 × 12', ''),
    ex('Cable crunch', '3 × 15', ''),
  ]},
  V_UB: { title: 'Upper B — arms & back width', kind: 'strength', items: [
    ex('Incline dumbbell press', '4 × 10', 'Upper chest — what fills a sherwani'),
    ex('Wide-grip lat pulldown', '4 × 12', 'Width'),
    ex('Chest-supported row', '3 × 12', 'Thickness'),
    ex('Lateral raise', '4 × 15', 'Light, slow, high reps'),
    ex('EZ-bar curl', '4 × 10', ''),
    ex('Skull crusher or dips', '4 × 10', 'Triceps are two-thirds of the arm'),
    ex('Face pull', '3 × 15', 'Posture, and it protects your shoulders'),
  ]},

  /* --- Home / travel (blocks 2 & 4) --- */
  M_HOME: { title: 'Home Full Body', kind: 'strength', items: [
    ex('Goblet squat', '3 × 12', 'Light weight, 3-second lower, pause at the bottom'),
    ex('Dumbbell RDL', '3 × 12', ''),
    ex('Single-leg glute bridge', '3 × 12 / side', ''),
    ex('Band pull-apart + dumbbell row', '3 × 15 / 3 × 12', ''),
    ex('Dumbbell floor press or push-up', '3 × 10', ''),
    ex('Banded lateral walk', '3 × 15 steps each way', ''),
    ex('Plank + side plank', '2 rounds', ''),
  ]},
  V_HOME_L: { title: 'Home Lower', kind: 'strength', items: [
    ex('Barbell squat', '4 × 8', 'Higher reps to make 70 kg count'),
    ex('Romanian deadlift', '4 × 10', ''),
    ex('Bulgarian split squat', '3 × 12 / leg', ''),
    ex('Single-leg calf raise', '3 × 20', ''),
  ]},
  V_HOME_U: { title: 'Home Upper', kind: 'strength', items: [
    ex('Barbell or dumbbell press', '4 × 8', ''),
    ex('Barbell row', '4 × 10', ''),
    ex('Overhead press', '3 × 10', ''),
    ex('Curl and extension', '3 × 15 each', ''),
    ex('Push-ups to finish', '2 × max', ''),
  ]},

  /* --- Swim & recovery --- */
  SWIM_1: { title: 'Swim — breathing & float', kind: 'swim', items: [
    ex('Kickboard lengths', '10 min', 'Face in, exhale through the nose the whole time'),
    ex('Bobbing', '10 min', 'Exhale fully under, inhale at the surface. Until it is boring'),
    ex('Single-arm freestyle', '10 min', 'Other hand on the board'),
  ]},
  SWIM_2: { title: 'Swim — putting it together', kind: 'swim', items: [
    ex('Easy warm-up', '5 min', ''),
    ex('15 m freestyle repeats', '8 × 15 m', '30 s rest. Clean technique beats distance'),
    ex('Kick and drill', '10 min', ''),
    ex('Unbroken attempt', '1 × 25 m', ''),
  ]},
  SWIM_3: { title: 'Swim — distance', kind: 'swim', items: [
    ex('Easy warm-up', '5 min', ''),
    ex('Unbroken swims', '4 × 25 m', 'Build toward 50 m unbroken'),
    ex('Drill work', '10 min', ''),
  ]},
  /* optional: true — counts as a bonus when done, never as a miss when skipped */
  ACTIVE: { title: 'Active recovery', kind: 'active', optional: true, items: [
    ex('Badminton, cycling, or a hike', '45–60 min', 'It counts. It is meant to be enjoyable'),
  ]},
  MOBILITY: { title: 'Mobility', kind: 'active', optional: true, items: [
    ex('Hips, shoulders, ankles', '10–15 min', 'Easy. After the swim'),
  ]},
  REST: { title: 'Rest', kind: 'rest', items: [] },
  MVS: { title: 'Minimum viable session — 20 min', kind: 'strength', items: [
    ex('Squat (goblet or bodyweight)', '3 × 15', ''),
    ex('Push-up at any height', '3 × 10', ''),
    ex('Hip hinge / RDL with anything heavy', '3 × 12', ''),
    ex('Row — dumbbell, band, or a heavy bag', '3 × 15', ''),
    ex('Plank', '3 × 45 s', ''),
    ex('Walking lunge', '3 × 10 / leg', ''),
  ]},
};

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
    if (dow === 2) return swimFor(week);
    if (dow === 4) return swimFor(week);
    // Block 3 adds a fourth strength day, rotating A → B → C
    if (dow === 6) return block === 3 ? ['M_A', 'M_B', 'M_C'][(week - 11) % 3] : 'ACTIVE';
    return 'REST';
  }

  // vaibhav
  if (home) {
    // Alternates week to week: L-U-L, then U-L-U
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
  if (dow === 2) return swimFor(week);
  if (dow === 4) return swimFor(week);
  return 'REST';
}

function swimFor(week) {
  if (week <= 2) return 'SWIM_1';
  if (week <= 5) return 'SWIM_2';
  return 'SWIM_3';
}

/* Milestones keyed by week number */
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
