import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/brand';
import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice, Row } from '@/components/caregiver-ui';
import { Checkbox, Sheet } from '@/components/sheet';
import { readExport, readPhoneCopy, readPhotos } from '@/data/export-data';
import { studyToday } from '@/data/study-clock';
import { EXPORT_PROBLEM, exportFileName, exportText, familyExport, type Cancel, type ExportProblem, type ExportProgress, type ExportRead, type ExportSource } from '@/lib/export';
import { reportHtml, reportOf } from '@/lib/insight-report';
import { warnKind } from '@/lib/log';
import { sharePdf, shareFile } from '@/lib/save-file';
import { Space } from '@/theme/layout';

// Export my data (Settings → Privacy and data, and "Export my data first" inside Delete account): the
// caregiver's own family as a data file of everything, a readable report as a PDF, and, only when
// "Include photos" is ticked, the photos as a zip. Made only on the caregiver's request, written to
// the app's temporary folder, handed to the share sheet, and deleted once it closes. Nothing is made
// from part of the data without saying so: a failed read says what failed, with Try again, and
// offline the caregiver may choose this phone's copy, which the file and report label as such.

type Kind = 'data' | 'report' | 'photos';

type Phase =
  | { at: 'idle'; notice?: string }
  | { at: 'reading'; kind: Kind; progress?: ExportProgress }
  | { at: 'writing'; kind: Kind }
  | { at: 'problem'; kind: Kind; problem: ExportProblem | 'file' | 'cannot-share' };

const STEP_WORDS: Record<ExportProgress['step'], (progress: ExportProgress) => string> = {
  family: () => 'Reading your people and stories…',
  sessions: ({ done }) => `Reading practice sessions… ${done.toLocaleString()} so far`,
  records: ({ done }) => `Reading card records… ${done.toLocaleString()} so far`,
  schedule: () => 'Reading the practice schedule…',
  photos: ({ done, total }) => (total ? `Gathering photos… ${done} of ${total}` : 'Gathering photos…'),
};

const FILE_PROBLEM = 'The file couldn’t be made on this phone, so nothing was saved. Please try again.';
const SHARE_PROBLEM = 'This phone can’t share a file. Please try on another phone.';

const READY: Record<Kind, string> = {
  data: 'Your data file is ready. Keep it somewhere safe.',
  report: 'Your report is ready. Share it carefully.',
  photos: 'Your photos are ready. Share them only with people you trust.',
};
const READY_FROM_COPY = 'Made from this phone’s copy, so it may be missing newer data. Export again once you’re online for a complete copy.';

/** Writes the file for a kind and opens the share sheet. False if the phone can't share. */
async function writeAndShare(kind: Exclude<Kind, 'photos'>, source: ExportSource) {
  const now = new Date();
  if (kind === 'data') return shareFile(exportFileName('data', now), exportText(familyExport(source, now, Constants.expoConfig?.version ?? '1.0.0')), 'json');
  return sharePdf(exportFileName('report', now), reportHtml(reportOf(source, studyToday(now))));
}

/** What Export my data shows: the choices, progress with Cancel, and what happened. Used in its own sheet and inside Delete account. */
export function ExportPanel() {
  const [phase, setPhase] = useState<Phase>({ at: 'idle' });
  const [photos, setPhotos] = useState(false);
  const cancel = useRef<Cancel | null>(null);

  // Closing the sheet mid-read stops it.
  useEffect(
    () => () => {
      if (cancel.current) cancel.current.cancelled = true;
    },
    [],
  );

  async function run(kind: Kind, fromCopy = false) {
    const stop: Cancel = { cancelled: false };
    cancel.current = stop;
    setPhase({ at: 'reading', kind });
    const onProgress = (progress: ExportProgress) => {
      if (!stop.cancelled) setPhase({ at: 'reading', kind, progress });
    };
    const read: ExportRead<ExportSource | { zip: Uint8Array; count: number }> =
      kind === 'photos' ? await readPhotos(onProgress, stop) : fromCopy && readPhoneCopy ? await readPhoneCopy() : await readExport(onProgress, stop);
    if (cancel.current !== stop) return;
    cancel.current = null;
    if (!read.ok) {
      setPhase('cancelled' in read ? { at: 'idle', notice: 'Stopped. Nothing was saved.' } : { at: 'problem', kind, problem: read.problem });
      return;
    }
    if (kind === 'photos' && 'zip' in read.value && read.value.count === 0) {
      setPhase({ at: 'idle', notice: 'There are no photos you added to export.' });
      return;
    }
    setPhase({ at: 'writing', kind });
    try {
      const shared = 'zip' in read.value ? await shareFile(exportFileName('photos', new Date()), read.value.zip, 'zip') : await writeAndShare(kind as Exclude<Kind, 'photos'>, read.value);
      if (!shared) setPhase({ at: 'problem', kind, problem: 'cannot-share' });
      else setPhase({ at: 'idle', notice: fromCopy ? `${READY[kind]} ${READY_FROM_COPY}` : READY[kind] });
    } catch (error) {
      warnKind('Could not write the export', error);
      setPhase({ at: 'problem', kind, problem: 'file' });
    }
  }

  const busy = phase.at === 'reading' || phase.at === 'writing';
  const problemWords = phase.at === 'problem' ? (phase.problem === 'file' ? FILE_PROBLEM : phase.problem === 'cannot-share' ? SHARE_PROBLEM : EXPORT_PROBLEM[phase.problem]) : undefined;
  const offerCopy = phase.at === 'problem' && phase.problem === 'offline' && phase.kind !== 'photos' && readPhoneCopy;

  return (
    <View style={styles.panel}>
      <AppText>Make a copy of your family’s data to keep, in case anything is ever lost.</AppText>
      <AppText size="caption" muted>
        Exports hold personal information: names, stories and how practice went. They’re made only when you ask. Share them carefully.
      </AppText>

      <View style={styles.choice}>
        <BigButton testID="export-file" label="Data file (everything)" primary disabled={busy} onPress={() => run('data')} />
        <AppText size="caption" muted>
          Every person, story, setting, session and card record, as a JSON file.
        </AppText>
      </View>
      <View style={styles.choice}>
        <BigButton testID="export-report" label="Report (PDF)" disabled={busy} onPress={() => run('report')} />
        <AppText size="caption" muted>
          A short summary of practice by study day that you could share with a clinician.
        </AppText>
      </View>

      <View style={styles.choice}>
        <Checkbox testID="export-include-photos" checked={photos} onChange={setPhotos}>
          Include photos
        </Checkbox>
        {photos ? (
          <>
            <AppText size="caption" muted>
              A separate zip file of the photos you added, as stored. Photos show faces: share them only with people you trust.
            </AppText>
            <BigButton testID="export-photos" label="Photos (zip)" disabled={busy} onPress={() => run('photos')} />
          </>
        ) : null}
      </View>

      {busy ? (
        <View style={styles.choice}>
          <AppText testID="export-progress" accessibilityLiveRegion="polite" size="caption">
            {phase.at === 'reading' ? (phase.progress ? STEP_WORDS[phase.progress.step](phase.progress) : 'Starting…') : 'Preparing the file…'}
          </AppText>
          {phase.at === 'reading' ? (
            <BigButton
              testID="export-cancel"
              quiet
              label="Cancel"
              onPress={() => {
                if (cancel.current) cancel.current.cancelled = true;
                cancel.current = null;
                setPhase({ at: 'idle', notice: 'Stopped. Nothing was saved.' });
              }}
            />
          ) : null}
        </View>
      ) : null}

      {phase.at === 'problem' ? (
        <View style={styles.choice}>
          <Notice>{problemWords}</Notice>
          <BigButton testID="export-retry" label="Try again" onPress={() => run(phase.kind)} />
          {offerCopy ? (
            <>
              <BigButton testID="export-phone-copy" quiet label="Use this phone’s copy" onPress={() => run(phase.kind, true)} />
              <AppText size="caption" muted>
                Made from what this phone already has. It may be missing newer data from the server, and the file says so.
              </AppText>
            </>
          ) : null}
        </View>
      ) : null}
      {phase.at === 'idle' && phase.notice ? <Notice>{phase.notice}</Notice> : null}

      <AppText size="caption" muted>
        {APP_NAME} can’t read an export back. Restoring from one is done by hand by the app’s developer.
      </AppText>
    </View>
  );
}

/** The Settings row and its sheet. */
export function ExportSetting() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row testID="export-data" label="Export my data" onPress={() => setOpen(true)} />
      <Sheet visible={open} title="Export my data" onClose={() => setOpen(false)}>
        {open ? <ExportPanel /> : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Space.m,
  },
  choice: {
    gap: Space.xs,
  },
});
