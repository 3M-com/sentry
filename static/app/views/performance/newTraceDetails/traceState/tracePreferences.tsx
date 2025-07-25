import * as Sentry from '@sentry/react';

import clamp from 'sentry/utils/number/clamp';
import {traceReducerExhaustiveActionCheck} from 'sentry/views/performance/newTraceDetails/traceState';

type TraceLayoutPreferences = 'drawer left' | 'drawer bottom' | 'drawer right';

type TracePreferencesAction =
  | {payload: TraceLayoutPreferences; type: 'set layout'}
  | {
      payload: number;
      type: 'set drawer dimension';
    }
  | {payload: number; type: 'set list width'}
  | {payload: boolean; type: 'minimize drawer'}
  | {payload: boolean; type: 'set missing instrumentation'}
  | {payload: boolean; type: 'set autogrouping'};

type TraceDrawerPreferences = {
  layoutOptions: TraceLayoutPreferences[];
  minimized: boolean;
  sizes: Record<TraceLayoutPreferences, number>;
};

export type TracePreferencesState = {
  autogroup: {
    parent: boolean;
    sibling: boolean;
  };
  drawer: TraceDrawerPreferences;
  layout: TraceLayoutPreferences;
  list: {
    width: number;
  };
  missing_instrumentation: boolean;
};

export type StoredTracePreferences = {
  autogroup: TracePreferencesState['autogroup'];
  drawer_layout: TraceLayoutPreferences;
  missing_instrumentation: boolean;
};

export const TRACE_DRAWER_DEFAULT_SIZES: TraceDrawerPreferences['sizes'] = {
  'drawer left': 0.4,
  'drawer right': 0.4,
  'drawer bottom': 0.5,
};

export const DEFAULT_TRACE_VIEW_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: false,
    sizes: {...TRACE_DRAWER_DEFAULT_SIZES},
    layoutOptions: ['drawer left', 'drawer right', 'drawer bottom'],
  },
  autogroup: {
    parent: true,
    sibling: true,
  },
  missing_instrumentation: true,
  layout: 'drawer right',
  list: {
    width: 0.5,
  },
};

export function storeTraceViewPreferences(
  key: string,
  state: TracePreferencesState
): void {
  const storedState: StoredTracePreferences = {
    drawer_layout: state.layout,
    missing_instrumentation: state.missing_instrumentation,
    autogroup: state.autogroup,
  };

  // Make sure we dont fire this during a render phase
  window.requestAnimationFrame(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedState));
    } catch (e) {
      Sentry.captureException(e);
    }
  });
}

function isPreferenceState(parsed: any): parsed is StoredTracePreferences {
  return (
    'drawer_layout' in parsed &&
    'missing_instrumentation' in parsed &&
    'autogroup' in parsed
  );
}

function isValidAutogrouping(
  state: StoredTracePreferences
): state is StoredTracePreferences & {autogrouping: undefined} {
  if (state.autogroup === undefined) {
    return false;
  }
  if (
    typeof state.autogroup.parent !== 'boolean' ||
    typeof state.autogroup.sibling !== 'boolean'
  ) {
    return false;
  }
  return true;
}

function isValidMissingInstrumentation(
  state: StoredTracePreferences
): state is StoredTracePreferences & {missing_instrumentation: undefined} {
  if (typeof state.missing_instrumentation !== 'boolean') {
    return false;
  }
  return true;
}

function loadTraceViewPreferences(key: string): StoredTracePreferences | null {
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // We need a more robust way to validate the stored preferences.
      // Since we dont have a schema validation lib, just do it manually for now.
      if (isPreferenceState(parsed)) {
        // Correct old preferences that are missing autogrouping
        if (!isValidAutogrouping(parsed)) {
          parsed.autogroup = {...DEFAULT_TRACE_VIEW_PREFERENCES.autogroup};
        }
        if (!isValidMissingInstrumentation(parsed)) {
          parsed.missing_instrumentation =
            DEFAULT_TRACE_VIEW_PREFERENCES.missing_instrumentation;
        }
        return parsed;
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return null;
}

export function getInitialTracePreferences(
  key: string,
  default_state: TracePreferencesState
): TracePreferencesState {
  const stored = loadTraceViewPreferences(key);
  const preferences = default_state;

  if (stored) {
    preferences.autogroup = stored.autogroup;
    preferences.missing_instrumentation = stored.missing_instrumentation;
    preferences.layout = stored.drawer_layout;
  }

  return preferences;
}

export function tracePreferencesReducer(
  state: TracePreferencesState,
  action: TracePreferencesAction
): TracePreferencesState {
  switch (action.type) {
    case 'minimize drawer':
      return {...state, drawer: {...state.drawer, minimized: action.payload}};
    case 'set layout':
      return {
        ...state,
        layout: action.payload,
        drawer: {...state.drawer, minimized: false},
      };
    case 'set drawer dimension':
      return {
        ...state,
        drawer: {
          ...state.drawer,
          sizes: {
            ...state.drawer.sizes,
            [state.layout]: clamp(action.payload, 0, 1),
          },
        },
      };
    case 'set autogrouping': {
      return {
        ...state,
        autogroup: {sibling: action.payload, parent: action.payload},
      };
    }
    case 'set missing instrumentation':
      return {
        ...state,
        missing_instrumentation: action.payload,
      };
    case 'set list width':
      return {
        ...state,
        list: {
          width: clamp(action.payload, 0.1, 0.9),
        },
      };
    default:
      traceReducerExhaustiveActionCheck(action);
      return state;
  }
}
