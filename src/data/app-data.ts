import { useCallback, useEffect, useState } from 'react';

import { AUTH_ENABLED } from '@/config/features';
import { deleteFamily, signOut, useAccount } from '@/data/account';
import { loadActivity, type Activity } from '@/data/activity-store';
import * as consent from '@/data/consent-store';
import * as family from '@/data/family-store';
// What this phone kept from the server goes whenever a login signs out here.
import '@/data/forget';
import { refreshFamily, setRevealCards as saveRevealCards, setSessionLength as saveSessionLength, useFamily, useFamilyFailed, useFamilyProblem, type Family } from '@/data/family-store';
import { problemOf, type LoadProblem } from '@/lib/load-problem';
import { rememberTrends, updateInsights, useServerInsights, type InsightsSync, type TrendsCopy } from '@/data/insights-store';
import * as local from '@/data/local-store';
import * as server from '@/data/practice-store';
import type { CardTiming } from '@/lib/attempts';
import type { InsightsData } from '@/lib/insights';
import type { Round } from '@/lib/stories';

// Everything that depends on the sign-in switch (src/config/features.ts). With sign-in on,
// the Supabase stores; with it off, the local store. Screens that work both ways import
// from here. Each choice is made once, when the app starts.

export { askedToday, completedToday, deckCards, doneToday, lastSeen, sessionCards, type Practice, type SessionKind } from '@/data/practice-store';

/** Sign-in is off: everything stays on this phone. */
export const LOCAL_ONLY = !AUTH_ENABLED;

export type Role = 'person' | 'caregiver';

/** Who is using the app. role is null while nobody is signed in. */
export type Who = { ready: boolean; role: Role | null; name: string };

function useAccountWho(): Who {
  const account = useAccount();
  return {
    ready: account.status !== 'loading',
    role: account.status === 'signed-in' ? account.profile.role : null,
    name: account.status === 'signed-in' ? account.profile.displayName : '',
  };
}

function useLocalWho(): Who {
  return { ready: local.useLocalReady(), role: local.useLocalRole(), name: '' };
}

export const useWho = AUTH_ENABLED ? useAccountWho : useLocalWho;

export const usePractice = AUTH_ENABLED ? server.usePractice : local.useLocalPractice;
export const refreshPractice = AUTH_ENABLED ? server.refreshPractice : local.refreshLocal;
export const newSessionId = AUTH_ENABLED ? server.newSessionId : local.newLocalSessionId;
export const startSession = AUTH_ENABLED ? server.startSession : local.startLocalSession;
export const recordCard = AUTH_ENABLED ? server.recordCard : local.recordLocalCard;
export const finishSession = AUTH_ENABLED ? server.finishSession : local.finishLocalSession;

/**
 * Each card's record for the caregiver's insights. With sign-in off, kept on this phone, where the
 * caregiver looks at them. With sign-in on, this is the practice device, signed in as the person:
 * the record is queued here and uploaded, write-only, for the caregiver's phone to read.
 */
export const recordAttempt: (sessionId: string, card: Round, timing: CardTiming) => void = AUTH_ENABLED ? server.recordAttempt : local.recordLocalAttempt;

export type Dashboard = {
  family: Family | null;
  activity: Activity | null;
  /** When the family started, for the 4-week average. */
  since: Date | null;
  /** Something couldn't load. */
  failed: boolean;
  /** Why: offline, sign-in ended, the server not yet updated, or the server away. */
  problem?: LoadProblem;
  reload: () => void;
  /**
   * The caregiver's insights. With sign-in off, the records on this phone. With sign-in on, the
   * family's records from the server (and any still queued on this phone), once they have loaded.
   */
  insights?: InsightsData;
  /** With sign-in on only: when Insights were last fetched, and fetching again. */
  insightsSync?: InsightsSync;
  /** With sign-in on only: Trends as last seen on this phone, while the family or practice can't load (offline). */
  savedTrends?: TrendsCopy;
};

/** The caregiver's device with sign-in on: the family, completion and insights, all from the server. */
function useServerDashboard(): Dashboard {
  const account = useAccount();
  const family = useFamily();
  const familyFailed = useFamilyFailed();
  const insights = useServerInsights(family?.people);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityFailed, setActivityFailed] = useState<LoadProblem | false>(false);
  const familyProblem = useFamilyProblem();
  // What Trends need, kept with Insights' copy, so both open offline next time. Whichever loads last.
  const { ready } = insights;
  useEffect(() => {
    if (family && activity && ready) rememberTrends(family, activity);
  }, [family, activity, ready]);
  const reload = useCallback(() => {
    refreshFamily();
    loadActivity().then(
      (loaded) => {
        setActivity(loaded);
        setActivityFailed(false);
      },
      (error) => setActivityFailed(problemOf(error)),
    );
    void updateInsights();
  }, []);
  return {
    family,
    activity,
    since: account.status === 'signed-in' ? new Date(account.profile.createdAt) : null,
    failed: familyFailed || Boolean(activityFailed),
    problem: familyProblem ?? (activityFailed || undefined),
    reload,
    insights: insights.data,
    insightsSync: insights.sync,
    savedTrends: family && activity ? undefined : (insights.trends ?? undefined),
  };
}

/**
 * The caregiver signs out here. Every copy of server data kept on this phone for that login goes with
 * the session (src/data/forget.ts): the family, the copy of Insights, the photos in the image cache.
 */
export const signOutCaregiver = signOut;

/** Deletes the whole family on the server, then signs out here, which clears this phone's copies as above. */
export const deleteFamilyHere = deleteFamily;

export const useDashboard: () => Dashboard = AUTH_ENABLED ? useServerDashboard : local.useLocalDashboard;

export const setSessionLength = AUTH_ENABLED ? saveSessionLength : local.setLocalSessionLength;
export const setRevealCards = AUTH_ENABLED ? saveRevealCards : local.setLocalRevealCards;

// The family, for add a person (screen 5), story approval (screen 6) and the People tab.
export const useFamilyView: () => Family | null = AUTH_ENABLED ? useFamily : local.useLocalFamily;
export const addPerson = AUTH_ENABLED ? family.addPerson : local.addLocalPerson;
export const updatePerson = AUTH_ENABLED ? family.updatePerson : local.updateLocalPerson;
export const saveFacts = AUTH_ENABLED ? family.saveFacts : local.saveLocalFacts;
export const setCardStatus = AUTH_ENABLED ? family.setCardStatus : local.setLocalCardStatus;
export const editCard = AUTH_ENABLED ? family.editCard : local.editLocalCard;
/** One person's cards to the newest wording, on purpose (docs/SENTENCE-AUDIT.md). */
export const moveToNewWording = AUTH_ENABLED ? family.moveToNewWording : local.moveLocalToNewWording;
export const archivePerson = AUTH_ENABLED ? family.archivePerson : local.archiveLocalPerson;
export const restorePerson = AUTH_ENABLED ? family.restorePerson : local.restoreLocalPerson;
export const deletePerson = AUTH_ENABLED ? family.deletePerson : local.deleteLocalPerson;
export const setHints = AUTH_ENABLED ? family.setHints : local.setLocalHints;
export const setPhrasingsOff = AUTH_ENABLED ? family.setPhrasingsOff : local.setLocalPhrasingsOff;
export const setProfile = AUTH_ENABLED ? family.setProfile : local.setLocalProfile;
export const addToPractice = AUTH_ENABLED ? family.addToPractice : local.addLocalToPractice;
export const setIncludeInPractice = AUTH_ENABLED ? family.setIncludeInPractice : local.setLocalIncluded;
export const setRevealOk = AUTH_ENABLED ? family.setRevealOk : local.setLocalRevealOk;
export const setFactHints = AUTH_ENABLED ? family.setFactHints : local.setLocalFactHints;
/** Approve all on a person's sheet, and its Undo. With sign-in on there are no AI sentences, so only stories. */
export const approveAll = AUTH_ENABLED ? family.approveAll : local.approveAllLocal;
export const undoApproveAll = AUTH_ENABLED ? family.undoApproveAll : local.undoApproveAllLocal;

export const { openCaregiver, closeCaregiver, practiceWith, takeHandoff } = local;

// AI questions exist only with sign-in off (AI_AVAILABLE), so these are always the phone's.
export const {
  agreeToLocalAi: agreeToAi,
  approveAllLocalSentences: approveAllSentences,
  approveLocalSentence: approveAiSentence,
  editLocalSentence: editAiSentence,
  generateLocalQuestions: generateQuestions,
  rejectLocalSentence: rejectAiSentence,
  setLocalAiOk: setAiOk,
  setLocalAiOn: setAiOn,
  withdrawLocalAi: withdrawAiConsent,
} = local;

// The caregiver's agreements (src/lib/consent.ts). With sign-in on, versioned records on the server; with
// it off there is no account, so nothing to agree to and nothing to ask.
const NO_ACCOUNT: consent.ConsentView = { status: 'current', research: false };
export const useConsent: () => consent.ConsentView = AUTH_ENABLED ? consent.useConsent : () => NO_ACCOUNT;
export const loadConsent: () => Promise<void> = AUTH_ENABLED ? consent.loadConsent : async () => {};
export const { agreeToPolicy, setResearch } = consent;

/** With sign-in on, the caregiver's login has no practice, so nothing is ever handed over. */
export const useHandoff: () => string | null = AUTH_ENABLED ? () => null : local.useHandoff;
