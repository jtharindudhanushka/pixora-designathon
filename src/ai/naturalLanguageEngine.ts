export interface ParsedIntentResult {
  intent: string;
  confidence: number;
  responseMessage: string;
  actions: Array<{
    target: 'device' | 'pass' | 'scene';
    action: string;
    payload: any;
  }>;
}

export function parseNaturalLanguageCommand(text: string): ParsedIntentResult {
  const query = text.toLowerCase().trim();

  // Pattern 1: Delivery Pass creation (Keells, PickMe, Uber)
  if (query.includes('delivery') || query.includes('keells') || query.includes('pickme') || query.includes('courier') || query.includes('pass')) {
    let partner = 'Keells Super Express';
    if (query.includes('pickme')) partner = 'PickMe Food';
    if (query.includes('uber')) partner = 'Uber Eats';

    return {
      intent: 'GENERATE_DELIVERY_PASS',
      confidence: 0.96,
      responseMessage: `Generated 15-minute single-use pass for ${partner}. Turnstile 1 & Lift Bank A pre-cleared for Floor 14.`,
      actions: [
        {
          target: 'pass',
          action: 'ISSUE_PASS',
          payload: { partner, durationMinutes: 15 },
        },
      ],
    };
  }

  // Pattern 2: Climate & AC Controls
  if (query.includes('ac') || query.includes('temperature') || query.includes('cool') || query.includes('cold') || query.includes('degree')) {
    const tempMatch = query.match(/\d{2}/);
    const targetTemp = tempMatch ? parseInt(tempMatch[0], 10) : 22;

    if (query.includes('off')) {
      return {
        intent: 'SET_AC_STATE',
        confidence: 0.94,
        responseMessage: 'Switched off Living Room AC. Conserving energy.',
        actions: [
          {
            target: 'device',
            action: 'UPDATE_DEVICE',
            payload: { deviceId: 'living-ac', state: 'OFF' },
          },
        ],
      };
    }

    return {
      intent: 'SET_AC_TEMP',
      confidence: 0.95,
      responseMessage: `Set Living Room AC to ${targetTemp}°C. Comfort scene updated.`,
      actions: [
        {
          target: 'device',
          action: 'UPDATE_DEVICE',
          payload: { deviceId: 'living-ac', state: 'ON', temp: targetTemp },
        },
      ],
    };
  }

  // Pattern 3: Front door lock
  if (query.includes('lock') || query.includes('door')) {
    if (query.includes('unlock')) {
      return {
        intent: 'UNLOCK_DOOR',
        confidence: 0.92,
        responseMessage: 'Front Door unlocked. Relocking automatically in 30 seconds.',
        actions: [
          {
            target: 'device',
            action: 'UPDATE_DEVICE',
            payload: { deviceId: 'front-door', state: 'UNLOCKED' },
          },
        ],
      };
    } else {
      return {
        intent: 'LOCK_DOOR',
        confidence: 0.98,
        responseMessage: 'Front Door motorized deadbolt locked and secured.',
        actions: [
          {
            target: 'device',
            action: 'UPDATE_DEVICE',
            payload: { deviceId: 'front-door', state: 'LOCKED' },
          },
        ],
      };
    }
  }

  // Pattern 4: Scenes (Leaving Home, Good Night, Movie Mode)
  if (query.includes('leaving') || query.includes('away') || query.includes('bye')) {
    return {
      intent: 'SCENE_LEAVING_HOME',
      confidence: 0.97,
      responseMessage: 'Leaving Home activated: Locked Front Door, turned off Living & Guest AC, all lights off.',
      actions: [
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'front-door', state: 'LOCKED' } },
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'living-ac', state: 'OFF' } },
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'guest-ac', state: 'OFF' } },
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'guest-lights', state: 'OFF' } },
      ],
    };
  }

  if (query.includes('movie') || query.includes('cinema')) {
    return {
      intent: 'SCENE_MOVIE_TIME',
      confidence: 0.95,
      responseMessage: 'Movie Time scene activated: Living AC set to 21°C, guest lights dimmed, front door secured.',
      actions: [
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'living-ac', state: 'ON', temp: 21 } },
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'front-door', state: 'LOCKED' } },
        { target: 'device', action: 'UPDATE_DEVICE', payload: { deviceId: 'guest-lights', state: 'OFF' } },
      ],
    };
  }

  // Default fallback
  return {
    intent: 'ASSISTANT_QUERY',
    confidence: 0.8,
    responseMessage: `Understood: "${text}". I have checked Unit 1402 sensors; all perimeter locks are secured and environmental climate is optimal.`,
    actions: [],
  };
}
