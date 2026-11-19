// High-Fidelity Vector Graphics & Cutout Visuals matching screenshots
const HomeWorkoutVisuals = {
  // Coach Avatar with Clipboard & Smiling Expression
  getCoachAvatarSvg() {
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" style="border-radius: 50%;">
        <defs>
          <linearGradient id="coachSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFDFC4"/>
            <stop offset="100%" stop-color="#E5A67D"/>
          </linearGradient>
          <linearGradient id="coachShirt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="100%" stop-color="#E5E7EB"/>
          </linearGradient>
        </defs>
        <!-- Background Circle -->
        <circle cx="50" cy="50" r="48" fill="#F3F4F6"/>
        <!-- Torso in white athletic tank -->
        <path d="M 22 95 Q 26 64 36 60 L 64 60 Q 74 64 78 95 Z" fill="url(#coachShirt)" />
        <path d="M 38 60 L 50 72 L 62 60 Z" fill="url(#coachSkin)" />
        <!-- Head & Neck -->
        <rect x="42" y="46" width="16" height="18" rx="4" fill="url(#coachSkin)" />
        <ellipse cx="50" cy="38" rx="17" ry="21" fill="url(#coachSkin)" />
        <!-- Hair -->
        <path d="M 33 34 Q 35 18 50 17 Q 65 18 67 34 Q 63 22 50 21 Q 37 22 33 34 Z" fill="#4B2C19" />
        <!-- Facial Features -->
        <circle cx="44" cy="37" r="2" fill="#1F2937" />
        <circle cx="56" cy="37" r="2" fill="#1F2937" />
        <path d="M 44 47 Q 50 53 56 47" stroke="#993B14" stroke-width="2" fill="none" stroke-linecap="round" />
        <!-- Clipboard in hand -->
        <rect x="52" y="72" width="22" height="26" rx="2" fill="#92400E" transform="rotate(-10 52 72)" />
        <rect x="55" y="75" width="16" height="20" fill="#FFFFFF" transform="rotate(-10 52 72)" />
      </svg>
    `;
  },

  // 1. Full Body Shred Athlete: Muscular Blonde Man Hands on Hips
  getAthleteShredSvg() {
    return `
      <svg viewBox="0 0 200 240" width="100%" height="100%">
        <defs>
          <linearGradient id="shredSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCD5B5"/>
            <stop offset="40%" stop-color="#E2A676"/>
            <stop offset="100%" stop-color="#BA7A4C"/>
          </linearGradient>
          <linearGradient id="shredShorts" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1E3A8A"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <!-- Head & Blonde Hair -->
        <ellipse cx="100" cy="32" rx="18" ry="22" fill="url(#shredSkin)"/>
        <path d="M 82 28 Q 86 10 100 9 Q 114 10 118 28 Q 112 14 100 13 Q 88 14 82 28 Z" fill="#D97706"/>
        <!-- Neck -->
        <rect x="91" y="50" width="18" height="18" rx="4" fill="url(#shredSkin)"/>
        <!-- Shoulders & Traps -->
        <path d="M 68 66 Q 100 56 132 66 L 158 92 L 140 148 L 126 142 L 142 98 L 100 94 L 58 98 L 74 142 L 60 148 L 42 92 Z" fill="url(#shredSkin)"/>
        <!-- Torso & Abs Definition -->
        <path d="M 68 66 L 132 66 L 124 165 L 76 165 Z" fill="url(#shredSkin)"/>
        <!-- Pectoral Crease -->
        <path d="M 78 88 Q 100 96 122 88" stroke="#9A3412" stroke-width="2" fill="none" opacity="0.6"/>
        <line x1="100" y1="88" x2="100" y2="152" stroke="#9A3412" stroke-width="2" opacity="0.5"/>
        <!-- 6 Pack Blocks -->
        <rect x="85" y="104" width="12" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <rect x="103" y="104" width="12" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <rect x="85" y="118" width="12" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <rect x="103" y="118" width="12" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <rect x="86" y="132" width="11" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <rect x="103" y="132" width="11" height="10" rx="3" fill="#B45309" opacity="0.35"/>
        <!-- Shorts / Waist -->
        <path d="M 74 165 L 126 165 L 132 230 L 105 230 L 100 185 L 95 230 L 68 230 Z" fill="url(#shredShorts)"/>
      </svg>
    `;
  },

  // 2. Kegel Power Boost: Man in Glute / Pelvic Bridge Pose
  getAthleteKegelSvg() {
    return `
      <svg viewBox="0 0 240 180" width="100%" height="100%">
        <defs>
          <linearGradient id="kegelShirt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4B637B"/>
            <stop offset="100%" stop-color="#33475B"/>
          </linearGradient>
          <linearGradient id="kegelShorts" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
          <linearGradient id="kegelSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCD5B5"/>
            <stop offset="100%" stop-color="#D97706"/>
          </linearGradient>
        </defs>
        <!-- Head resting back -->
        <circle cx="52" cy="120" r="14" fill="url(#kegelSkin)" />
        <path d="M 44 116 Q 48 108 58 108 Q 62 116 64 122 Z" fill="#3E2723" />
        <!-- Neck & Shoulders Flat on Floor -->
        <path d="M 58 126 L 82 136 L 76 148 L 54 136 Z" fill="url(#kegelSkin)" />
        <!-- Elevated Torso & Spine in Bridge Angle -->
        <path d="M 78 136 L 152 76 L 180 94 L 98 152 Z" fill="url(#kegelShirt)" />
        <!-- Pelvic Peak & Hips -->
        <path d="M 148 76 L 188 74 L 198 114 L 176 96 Z" fill="url(#kegelShorts)" />
        <!-- Thighs & Bent Knees downward to feet -->
        <path d="M 188 74 L 225 125 L 210 135 L 178 90 Z" fill="url(#kegelSkin)" />
        <path d="M 225 125 L 218 165 L 202 165 L 210 135 Z" fill="url(#kegelSkin)" />
      </svg>
    `;
  },

  // 3. Get Ripped With Dumbbell: Athlete Bicep Curling Dumbbells
  getAthleteDumbbellSvg() {
    return `
      <svg viewBox="0 0 200 240" width="100%" height="100%">
        <defs>
          <linearGradient id="dumbSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCD5B5"/>
            <stop offset="100%" stop-color="#C27A4E"/>
          </linearGradient>
          <linearGradient id="dumbShirt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
        </defs>
        <!-- Head looking downward focused -->
        <ellipse cx="105" cy="40" rx="16" ry="19" fill="url(#dumbSkin)"/>
        <path d="M 90 35 Q 96 18 108 18 Q 118 20 120 35 Z" fill="#271E19"/>
        <!-- Torso in Black Compression Gear -->
        <path d="M 80 72 L 130 72 L 122 170 L 86 170 Z" fill="url(#dumbShirt)" />
        <path d="M 80 72 L 56 110 L 76 135 L 94 100 Z" fill="url(#dumbShirt)" />
        <!-- Right Forearm holding Dumbbell -->
        <path d="M 56 110 L 46 80 L 64 76 L 76 105 Z" fill="url(#dumbSkin)" />
        <!-- Dumbbell 1 -->
        <rect x="36" y="70" width="28" height="10" rx="2" fill="#0F172A" transform="rotate(-15 36 70)" />
        <rect x="30" y="62" width="10" height="26" rx="3" fill="#334155" transform="rotate(-15 36 70)" />
        <rect x="58" y="62" width="10" height="26" rx="3" fill="#334155" transform="rotate(-15 36 70)" />
        <!-- Left Arm & Dumbbell 2 -->
        <path d="M 130 72 L 152 110 L 138 135 L 120 100 Z" fill="url(#dumbShirt)" />
        <path d="M 152 110 L 164 85 L 148 80 L 138 105 Z" fill="url(#dumbSkin)" />
        <rect x="144" y="72" width="28" height="10" rx="2" fill="#0F172A" transform="rotate(15 144 72)" />
        <rect x="138" y="64" width="10" height="26" rx="3" fill="#334155" transform="rotate(15 144 72)" />
        <rect x="166" y="64" width="10" height="26" rx="3" fill="#334155" transform="rotate(15 144 72)" />
      </svg>
    `;
  },

  // 4. 28 Days Full Body: Muscular Man Looking Down
  getAthleteFullBodySvg() {
    return `
      <svg viewBox="0 0 200 240" width="100%" height="100%">
        <defs>
          <linearGradient id="fullSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCD5B5"/>
            <stop offset="50%" stop-color="#D97706"/>
            <stop offset="100%" stop-color="#92400E"/>
          </linearGradient>
        </defs>
        <!-- Head looking downward -->
        <ellipse cx="106" cy="42" rx="16" ry="19" fill="url(#fullSkin)" transform="rotate(10 106 42)" />
        <path d="M 92 36 Q 98 20 110 20 Q 120 22 122 38 Z" fill="#1C1917" />
        <!-- Neck & Massive Traps -->
        <path d="M 80 68 Q 106 58 132 68 L 156 94 L 142 145 L 124 140 L 136 98 L 106 94 L 74 98 L 86 140 L 68 145 L 54 94 Z" fill="url(#fullSkin)" />
        <!-- Ripped Torso -->
        <path d="M 80 68 L 132 68 L 122 165 L 86 165 Z" fill="url(#fullSkin)" />
        <!-- Chest Lines -->
        <path d="M 88 88 Q 106 96 124 88" stroke="#78350F" stroke-width="2" fill="none" opacity="0.6" />
        <line x1="106" y1="88" x2="106" y2="155" stroke="#78350F" stroke-width="2" opacity="0.5" />
        <!-- Abs grid -->
        <rect x="92" y="104" width="11" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <rect x="109" y="104" width="11" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <rect x="92" y="117" width="11" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <rect x="109" y="117" width="11" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <rect x="93" y="130" width="10" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <rect x="109" y="130" width="10" height="9" rx="2" fill="#78350F" opacity="0.3" />
        <!-- Dark shorts -->
        <path d="M 84 165 L 124 165 L 128 220 L 107 220 L 104 185 L 101 220 L 80 220 Z" fill="#0F172A" />
      </svg>
    `;
  }
};
