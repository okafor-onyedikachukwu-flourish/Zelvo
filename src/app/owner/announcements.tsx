import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../../components/DateField';
import { colors, space } from '../../components/theme';
import { Badge, Banner, Button, Card, ErrorView, Field, Input, LoadingView, Screen, SectionTitle, confirm } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { formatDate } from '../../lib/sheet/render';
import { must, supabase } from '../../lib/supabase';
import { useLoad } from '../../lib/useLoad';

async function load() {
  return must(
    await supabase.from('announcements').select('id, title, body, created_at, ends_at, stopped_at').order('created_at', { ascending: false }).limit(30),
  );
}

/** The owner writes a short notice that shows on everyone's Home screen until it ends or is stopped. */
export default function Announcements() {
  const { data, loading, error, reload } = useLoad(load, 'announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [until, setUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  const items = data ?? [];
  const isLive = (a: (typeof items)[number]) => !a.stopped_at && (!a.ends_at || new Date(a.ends_at) > new Date());

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  const post = () =>
    run('post', async () => {
      if (title.trim().length < 2) throw new Error('Write a short title.');
      const ok = await confirm('Post to everyone?', 'Every Zelvo user will see it on their Home screen.', 'Post');
      if (!ok) return;
      must(
        await supabase
          .from('announcements')
          .insert({ title: title.trim(), body: body.trim(), ends_at: until ? `${until}T23:59:59` : null })
          .select('id')
          .single(),
      );
      setTitle('');
      setBody('');
      setUntil(null);
      setMessage({ tone: 'success', text: 'Posted. People see it the next time they open Zelvo.' });
      await reload();
    });

  const stop = (id: string) =>
    run(id, async () => {
      must(await supabase.from('announcements').update({ stopped_at: new Date().toISOString() }).eq('id', id).select('id').single());
      await reload();
    });

  return (
    <Screen>
      {message ? <Banner tone={message.tone} icon={message.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'} title={message.text} /> : null}

      <Card>
        <Field label="Title">
          <Input value={title} onChangeText={setTitle} placeholder="e.g. New update: please install build 13" maxLength={80} />
        </Field>
        <Field label="Message (optional)">
          <Input
            value={body}
            onChangeText={setBody}
            placeholder="A sentence or two"
            multiline
            maxLength={600}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
        </Field>
        <Field label="Show until (optional)" hint="Leave empty to show it until you stop it.">
          <DateField value={until} onChange={setUntil} />
        </Field>
        <Button icon="megaphone-outline" title="Post to everyone" onPress={post} loading={busy === 'post'} />
      </Card>

      <SectionTitle>Posted</SectionTitle>
      {items.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.muted }}>Nothing posted yet.</Text>
      ) : (
        items.map((a) => (
          <Card key={a.id} style={{ marginBottom: space.sm, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>{a.title}</Text>
              <Badge label={isLive(a) ? 'Showing' : a.stopped_at ? 'Stopped' : 'Ended'} tone={isLive(a) ? 'success' : 'neutral'} />
            </View>
            {a.body ? <Text style={{ fontSize: 14, color: colors.text }}>{a.body}</Text> : null}
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Posted {formatDate(a.created_at.slice(0, 10))}
              {a.ends_at ? ` · until ${formatDate(a.ends_at.slice(0, 10))}` : ''}
            </Text>
            {isLive(a) ? (
              <Button small variant="secondary" title="Stop showing" onPress={() => stop(a.id)} loading={busy === a.id} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
