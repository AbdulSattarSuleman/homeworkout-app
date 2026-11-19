// Cali Move Workouts & Comprehensive Multi-Tier Exercise Database
const WORKOUTS_DATA = {
  levels: [
    { id: "beginner", name: "Level 1 • Beginner (Foundation)" },
    { id: "intermediate", name: "Level 2 • Intermediate (Strength & Hypertrophy)" },
    { id: "advanced", name: "Level 3 • Advanced (Skills & Explosive)" }
  ],

  programs: [
    {
      id: "basics",
      title: "Calisthenics Basics",
      subtitle: "Foundation, Joint Prep & Scapular Control",
      level: "Beginner",
      badge: "Foundation",
      weeks: 8,
      daysPerWeek: 3,
      themeColor: "#27ae60",
      description: "Build clean motor patterns, core stability, and bulletproof your tendons before jumping into high-volume training.",
      workouts: ["basics-w1", "basics-w2"]
    },
    {
      id: "hypertrophy",
      title: "Bodyweight Muscle Building",
      subtitle: "Hypertrophy, Dips, Pull-Ups & Volume",
      level: "Intermediate",
      badge: "Hypertrophy",
      weeks: 10,
      daysPerWeek: 4,
      themeColor: "#7c3aed",
      description: "Systematic mechanical drop-sets, progressive overload, and high-tension compound movements to pack on lean muscle.",
      workouts: ["inter-push", "inter-pull", "inter-legs-core"]
    },
    {
      id: "mobility",
      title: "Mobility & Joint Prep",
      subtitle: "Full Body Flexibility, Hips & Spine",
      level: "All Levels",
      badge: "Mobility",
      weeks: 6,
      daysPerWeek: 3,
      themeColor: "#059669",
      description: "Open tight hip flexors, mobilize thoracic spine, and improve overhead shoulder flexion for pain-free training.",
      workouts: ["mob-hips-spine", "mob-shoulders"]
    },
    {
      id: "skills",
      title: "Skill Mastery: Muscle-Up & Handstand",
      subtitle: "Elite Bodyweight Calisthenics",
      level: "Advanced",
      badge: "Skills",
      weeks: 12,
      daysPerWeek: 3,
      themeColor: "#f59e0b",
      description: "Step-by-step biomechanical progression drills to achieve a strict bar muscle-up and a solid freestanding handstand.",
      workouts: ["adv-muscleup", "adv-handstand"]
    }
  ],

  // Distinct Workouts
  workouts: [
    // ----------------------------------------------------
    // INTERMEDIATE WORKOUTS (User's Level)
    // ----------------------------------------------------
    {
      id: "inter-push",
      programId: "hypertrophy",
      title: "Intermediate Push: Dips & Chest Power",
      durationMin: 38,
      difficulty: "Intermediate",
      calories: 310,
      description: "High-intensity pressing workout emphasizing parallel bar dips, diamond triceps push-ups, and pike shoulder presses.",
      exercises: [
        {
          id: "parallel-dips",
          name: "Parallel Bar Dips",
          type: "reps",
          targetSets: 4,
          targetReps: "8 - 12 reps",
          workDuration: 40,
          restDuration: 90,
          video: "assets/videos/frames_60-60.mp4",
          alternateVideo: null,
          muscle: "Chest, Triceps & Front Delts",
          equipment: "Dip Station / Parallel Bars",
          tempo: "3-0-1-0 (3s controlled descent)",
          cues: [
            "Lean slightly forward (15-20°) to bias the pectoral fibers.",
            "Lower until elbows reach at least a 90-degree angle.",
            "Lock out at top with active scapular depression."
          ]
        },
        {
          id: "diamond-pushups",
          name: "Diamond Push-Ups",
          type: "reps",
          targetSets: 3,
          targetReps: "12 - 15 reps",
          workDuration: 35,
          restDuration: 60,
          video: "assets/videos/frames_119-119.mp4",
          alternateVideo: null,
          muscle: "Triceps & Inner Chest",
          equipment: "Floor Mat",
          tempo: "2-1-1-0 (Pause at chest touch)",
          cues: [
            "Form a diamond/triangle with thumbs and index fingers under the sternum.",
            "Keep elbows tucked close to the ribs as you descend.",
            "Squeeze triceps hard at lockout."
          ]
        },
        {
          id: "pike-pushup",
          name: "Pike Push-Up (Shoulder Builder)",
          type: "reps",
          targetSets: 3,
          targetReps: "8 - 10 reps",
          workDuration: 35,
          restDuration: 75,
          video: "assets/videos/test_60-60.mp4",
          alternateVideo: null,
          muscle: "Anterior Delts & Upper Traps",
          equipment: "Floor Mat / Elevated Box",
          tempo: "2-0-1-0",
          cues: [
            "Hips high in an inverted V shape, head between arms.",
            "Lower forward creating a tripod between head and hands.",
            "Press diagonally backward returning to the pike position."
          ]
        }
      ]
    },
    {
      id: "inter-pull",
      programId: "hypertrophy",
      title: "Intermediate Pull: Strict Pull-Ups & Back",
      durationMin: 36,
      difficulty: "Intermediate",
      calories: 290,
      description: "Lat and bicep volume routine featuring strict dead-hang pull-ups, horizontal inverted rows, and hollow core tension.",
      exercises: [
        {
          id: "strict-pullup",
          name: "Strict Dead-Hang Pull-Up",
          type: "reps",
          targetSets: 4,
          targetReps: "6 - 10 reps",
          workDuration: 35,
          restDuration: 90,
          video: "assets/videos/test_119-119.mp4",
          alternateVideo: null,
          muscle: "Lats, Biceps & Upper Back",
          equipment: "Pull-Up Bar",
          tempo: "2-1-1-0 (Dead-hang at bottom)",
          cues: [
            "Initiate by depressing and retracting your shoulder blades.",
            "Pull chest toward the bar until chin clears the bar with zero kipping.",
            "Lower slowly all the way down into full dead-hang stretch."
          ]
        },
        {
          id: "inverted-row",
          name: "Feet-Elevated Inverted Row",
          type: "reps",
          targetSets: 3,
          targetReps: "12 reps",
          workDuration: 40,
          restDuration: 60,
          video: "assets/videos/frames_60-60.mp4",
          alternateVideo: null,
          muscle: "Rhomboids, Rear Delts & Mid-Back",
          equipment: "Low Bar / Rings",
          tempo: "2-1-1-0",
          cues: [
            "Body in a rigid straight plank line.",
            "Pull sternum straight to the bar and squeeze shoulder blades together."
          ]
        },
        {
          id: "hollow-rock",
          name: "Hollow Body Rocking",
          type: "time",
          targetSets: 3,
          targetReps: "40 seconds",
          workDuration: 40,
          restDuration: 45,
          video: "assets/videos/test_119-119.mp4",
          alternateVideo: null,
          muscle: "Core & Rectus Abdominis",
          equipment: "Floor Mat",
          tempo: "Smooth Cadence",
          cues: [
            "Lower back glued to the floor.",
            "Rock gently from lower back to glutes without breaking body hollow arc."
          ]
        }
      ]
    },
    {
      id: "inter-legs-core",
      programId: "hypertrophy",
      title: "Intermediate Legs & Core Conditioning",
      durationMin: 34,
      difficulty: "Intermediate",
      calories: 320,
      description: "Unilateral lower body power and core stability using deep lunges, single-leg bridges, and tempo squats.",
      exercises: [
        {
          id: "walking-lunges",
          name: "Deep Walking Lunges",
          type: "reps",
          targetSets: 4,
          targetReps: "14 reps / leg",
          workDuration: 50,
          restDuration: 60,
          video: "assets/videos/lunge_n101.mp4",
          alternateVideo: null,
          muscle: "Quads, Glutes & Hamstrings",
          equipment: "Bodyweight",
          tempo: "Controlled Continuous",
          cues: [
            "Step forward into deep 90-degree flexion.",
            "Drive up through the front heel directly into the next step."
          ]
        },
        {
          id: "single-leg-bridge",
          name: "Single-Leg Glute Bridge Extension",
          type: "reps",
          targetSets: 3,
          targetReps: "12 reps / leg",
          workDuration: 45,
          restDuration: 45,
          video: "assets/videos/easy_bridge_side.mp4",
          alternateVideo: "assets/videos/easy_bridge_sideback.mp4",
          muscle: "Glutes & Posterior Chain",
          equipment: "Floor Mat",
          tempo: "2-1-2-0 (Hard squeeze at peak)",
          cues: [
            "Extend non-working leg straight in line with working thigh.",
            "Drive hip toward ceiling without tilting pelvis."
          ]
        }
      ]
    },

    // ----------------------------------------------------
    // BEGINNER WORKOUTS (Foundation)
    // ----------------------------------------------------
    {
      id: "basics-w1",
      programId: "basics",
      title: "Foundation Push & Core",
      durationMin: 28,
      difficulty: "Beginner",
      calories: 190,
      description: "Master baseline pushing mechanics and core tension using incline push-ups and isometric hollow holds.",
      exercises: [
        {
          id: "std-pushup",
          name: "Standard Push-Up (or Incline)",
          type: "reps",
          targetSets: 3,
          targetReps: "8 - 10 reps",
          workDuration: 30,
          restDuration: 60,
          video: "assets/videos/frames_119-119.mp4",
          alternateVideo: null,
          muscle: "Chest & Triceps",
          equipment: "Bodyweight",
          tempo: "2-0-1-0",
          cues: ["Straight line from head to heels.", "Elbows at 45° angle."]
        },
        {
          id: "glute-bridge-basic",
          name: "Two-Leg Glute Bridge",
          type: "reps",
          targetSets: 3,
          targetReps: "15 reps",
          workDuration: 35,
          restDuration: 45,
          video: "assets/videos/easy_bridge_side.mp4",
          alternateVideo: "assets/videos/easy_bridge_sideback.mp4",
          muscle: "Glutes & Lower Back",
          equipment: "Floor Mat",
          tempo: "2-1-1-0",
          cues: ["Feet flat, drive through heels.", "Squeeze at top."]
        }
      ]
    },
    {
      id: "basics-w2",
      programId: "basics",
      title: "Foundation Pull & Lower Body",
      durationMin: 26,
      difficulty: "Beginner",
      calories: 180,
      description: "Introductory unilateral leg control and horizontal pulling.",
      exercises: [
        {
          id: "lunge-basic",
          name: "Reverse Step Lunges",
          type: "reps",
          targetSets: 3,
          targetReps: "10 reps / leg",
          workDuration: 40,
          restDuration: 60,
          video: "assets/videos/lunge_n101.mp4",
          alternateVideo: null,
          muscle: "Quads & Glutes",
          equipment: "Bodyweight",
          tempo: "Slow & steady",
          cues: ["Step straight back.", "Keep torso upright."]
        }
      ]
    },

    // ----------------------------------------------------
    // MOBILITY WORKOUTS
    // ----------------------------------------------------
    {
      id: "mob-hips-spine",
      programId: "mobility",
      title: "Deep Hip & Spine Flow",
      durationMin: 22,
      difficulty: "All Levels",
      calories: 120,
      description: "Restorative flow targeting hip flexor opening, thoracic rotation, and posterior chain de-loading.",
      exercises: [
        {
          id: "hip-bridge-flow",
          name: "Hip Flexor Bridge Flow",
          type: "reps",
          targetSets: 2,
          targetReps: "12 reps",
          workDuration: 45,
          restDuration: 30,
          video: "assets/videos/easy_bridge_sideback.mp4",
          alternateVideo: "assets/videos/easy_bridge_side.mp4",
          muscle: "Hip Flexors & Glutes",
          equipment: "Floor Mat",
          tempo: "Slow Breathing",
          cues: ["Breathe deeply at top extension.", "Open tight hip capsules."]
        },
        {
          id: "lunge-opener",
          name: "Deep Lunge Hip Opener",
          type: "time",
          targetSets: 2,
          targetReps: "45s / side",
          workDuration: 45,
          restDuration: 30,
          video: "assets/videos/lunge_n101.mp4",
          alternateVideo: null,
          muscle: "Hip Flexors & Psoas",
          equipment: "Floor Mat",
          tempo: "Static Stretch",
          cues: ["Tuck pelvis under, feel stretch in rear hip."]
        }
      ]
    },

    // ----------------------------------------------------
    // ADVANCED WORKOUTS (Skills)
    // ----------------------------------------------------
    {
      id: "adv-muscleup",
      programId: "skills",
      title: "Explosive Muscle-Up Drills",
      durationMin: 42,
      difficulty: "Advanced",
      calories: 340,
      description: "High pull-ups, straight bar transition dips, and explosive chest-to-bar power.",
      exercises: [
        {
          id: "chest-to-bar",
          name: "Explosive Chest-to-Bar Pull-Up",
          type: "reps",
          targetSets: 5,
          targetReps: "4 - 6 reps",
          workDuration: 30,
          restDuration: 120,
          video: "assets/videos/test_119-119.mp4",
          alternateVideo: null,
          muscle: "Lats & Explosive Upper Body",
          equipment: "High Bar",
          tempo: "Explosive Concentric",
          cues: ["Pull violently downwards and backwards.", "Aim for lower chest or sternum to bar."]
        },
        {
          id: "straight-bar-dip",
          name: "Straight Bar Dip",
          type: "reps",
          targetSets: 4,
          targetReps: "8 reps",
          workDuration: 35,
          restDuration: 90,
          video: "assets/videos/frames_60-60.mp4",
          alternateVideo: null,
          muscle: "Triceps & Chest",
          equipment: "Bar",
          tempo: "Controlled",
          cues: ["Lean over the bar, lower until chest touches bar.", "Press to full lockout."]
        }
      ]
    }
  ],

  badges: [
    {
      id: "first_workout",
      title: "First Step",
      desc: "Completed your first workout routine",
      icon: "assets/images/badges/2.0x/badge_finished_workouts_amount_bronze_1.webp",
      unlocked: true,
      date: "Unlocked"
    },
    {
      id: "early_bird",
      title: "Early Bird",
      desc: "Trained before 8:00 AM",
      icon: "assets/images/badges/2.0x/badge_early_bird.webp",
      unlocked: true,
      date: "Unlocked"
    },
    {
      id: "five_workouts",
      title: "5 Workouts Strong",
      desc: "Completed 5 training sessions",
      icon: "assets/images/badges/2.0x/badge_finished_workouts_amount_bronze_5.webp",
      unlocked: true,
      date: "Unlocked"
    },
    {
      id: "intermediate_master",
      title: "Intermediate Master",
      desc: "Mastered Dips & Pull-Up progressions",
      icon: "assets/images/badges/2.0x/badge_finished_workouts_amount_gold_100.webp",
      unlocked: false,
      date: "In Progress (65%)"
    },
    {
      id: "anniversary",
      title: "App Anniversary",
      desc: "Special commemorative athlete badge",
      icon: "assets/images/badges/2.0x/badge_event_app_launch_anniversary.webp",
      unlocked: true,
      date: "Special Event"
    }
  ]
};
