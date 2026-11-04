import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '../components/Icons';
import { FADE_DELAY_OPTIONS } from '../constants/config';
import { fonts, palette, radius, space } from '../constants/theme';
import { useStrings } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import type { AnimationLevel, FadeDelay, Locale } from '../types';

/** A deliberately short settings sheet. No dashboards, no stats. */
export function SettingsScreen({ onClose, onReplayGuide }: { onClose: () => void; onReplayGuide: () => void }) {
  const t = useStrings().settings;
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#F8F0EB', '#F3E6EA', '#EDE4F1']} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t.title}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.done}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <CloseIcon />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Section title={t.sectionFade} caption={t.fadeCaption}>
          <Segmented<FadeDelay>
            options={FADE_DELAY_OPTIONS.map((v) => ({ value: v, label: t.fadeOption(v) }))}
            value={settings.fadeDelay}
            onChange={(v) => update({ fadeDelay: v })}
          />
        </Section>

        <Section title={t.sectionFeel}>
          <ToggleRow
            label={t.haptics}
            caption={t.hapticsCaption}
            value={settings.haptics}
            onChange={(v) => update({ haptics: v })}
          />
          <Divider />
          <ToggleRow label={t.sound} caption={t.soundCaption} value={settings.sound} onChange={(v) => update({ sound: v })} disabled />
          <Divider />
          <View style={styles.rowStack}>
            <Text style={styles.rowLabel}>{t.animation}</Text>
            <Segmented<AnimationLevel>
              options={[
                { value: 'soft', label: t.animationSoft },
                { value: 'full', label: t.animationFull },
              ]}
              value={settings.animationLevel}
              onChange={(v) => update({ animationLevel: v })}
            />
            <Text style={styles.caption}>{t.animationCaption}</Text>
          </View>
        </Section>

        <Pressable
          onPress={onReplayGuide}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, styles.linkRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.rowLabel}>{t.replayGuide}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Section title={t.sectionLanguage}>
          <Segmented<Locale>
            options={[
              { value: 'ko', label: t.languageKo },
              { value: 'en', label: t.languageEnSoon, disabled: true },
            ]}
            value={settings.locale}
            onChange={(v) => update({ locale: v })}
          />
        </Section>

        <Section title={t.sectionPrivacy}>
          {t.privacyItems.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.body}>{line}</Text>
            </View>
          ))}
          <Text style={[styles.caption, styles.limits]}>{t.privacyLimits}</Text>
        </Section>

        <Text style={styles.footer}>{t.version(version)}</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {children}
        {caption ? <Text style={[styles.caption, { marginTop: space.md }]}>{caption}</Text> : null}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow(props: { label: string; caption?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { label, caption, value, onChange, disabled } = props;
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: '#E3DAE6', true: palette.lavender }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E3DAE6"
      />
    </View>
  );
}

interface Option<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

function Segmented<T>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => !o.disabled && onChange(o.value)}
            disabled={o.disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!o.disabled }}
            style={[styles.segItem, selected && styles.segSelected, o.disabled && { opacity: 0.45 }]}
          >
            <Text style={[styles.segLabel, selected && styles.segLabelSelected]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cloud },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
  },
  title: { fontFamily: fonts.handBold, fontSize: 30, color: palette.dusk },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  content: { paddingHorizontal: space.gutter, gap: space.xl },
  section: { gap: space.sm },
  sectionTitle: { fontFamily: fonts.hand, fontSize: 19, color: palette.dusk, marginLeft: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#77758F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 22, color: palette.inkSoft, marginTop: -2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E6DCE8', marginVertical: space.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowStack: { gap: space.sm },
  rowLabel: { fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: palette.inkSoft, marginTop: 2 },
  body: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: palette.ink },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.blush, marginTop: 8 },
  limits: { marginTop: space.sm },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F1E9EE',
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segItem: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#77758F',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segLabel: { fontFamily: fonts.body, fontSize: 14, color: palette.inkSoft },
  segLabelSelected: { color: palette.dusk },
  footer: { fontFamily: fonts.body, fontSize: 12, color: palette.inkSoft, textAlign: 'center', marginTop: space.sm },
});
