import { Button, DatePicker, Form, Input, InputNumber, Popconfirm, Radio, Select, Table, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PostJsonData } from '../../utils/api';
import { useMobxStore } from '../../utils/mobxStore';
import { IEventorClassResult, IEventorEvent, IEventorEventRace, IEventorEvents, IEventorResults } from '../../utils/responseEventorInterfaces';
import LocationPickerMap from './LocationPickerMap';

// Row shape exchanged with the PHP backend (jsonEventorMapQuery.php / save.php).
export interface IEventRow {
  eventId: string;
  source: 'eventor' | 'legacy';
  name: string;
  date: string | null;
  classificationId: string | null;
  longitude: number;
  latitude: number;
  startCount: number | null;
  url: string | null;
  orderBy: number;
  eventStatus: string | null;
}

// Form-internal shape: antd's DatePicker works with a dayjs object, not a string.
type IEventForm = Omit<IEventRow, 'date' | 'source'> & { date?: dayjs.Dayjs | null };

// ── Eventor JSON helpers (proxy converts XML -> JSON) ──
const toArray = <T,>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const firstRace = (event: IEventorEvent): IEventorEventRace | undefined => toArray(event.EventRace)[0];

// Eventor EventStatusId values:
// 1 Applied, 2 ApprovedByRegion, 3 Approved, 4 Created, 5 EntryOpened,
// 6 EntryPaused, 7 EntryClosed, 8 Live, 9 Completed, 10 Canceled, 11 Reported.
// "Genomförd" = Completed or Reported (a reported event has been held).
const COMPLETED_STATUS_IDS = new Set(['9', '11']);

const isCompleted = (event: IEventorEvent): boolean =>
  COMPLETED_STATUS_IDS.has(event.EventStatusId);

// Coordinates live in EventCenterPosition['@attributes'] as lowercase x (lon) / y (lat).
const extractCoords = (event: IEventorEvent): [number, number] | null => {
  const pos = firstRace(event)?.EventCenterPosition?.['@attributes'];
  if (pos?.x && pos?.y) {
    const lon = parseFloat(pos.x);
    const lat = parseFloat(pos.y);
    if (!isNaN(lon) && !isNaN(lat)) return [lon, lat];
  }
  return null;
};

// Total number of starters for the whole event, as Eventor shows it on the
// event page. Each ClassResult carries a numberOfStarts attribute; the total
// is their sum across all classes (and races, for multi-day events).
const countStarters = (results: IEventorResults | IEventorResults[] | undefined): number | null => {
  const resultLists = toArray(results);
  if (resultLists.length === 0) return null;

  let total = 0;
  let found = false;
  for (const list of resultLists) {
    const classResults = toArray<IEventorClassResult>(list?.ClassResult);
    for (const cr of classResults) {
      const n = parseInt(cr?.['@attributes']?.numberOfStarts ?? '', 10);
      if (!isNaN(n)) {
        total += n;
        found = true;
      }
    }
  }
  return found ? total : null;
};

const classificationOptions = (t: (key: string, def: string) => string) => [
  { value: '1', label: t('eventmap.Championship', 'Mästerskapstävling') },
  { value: '2', label: t('eventmap.National', 'Nationell tävling') },
  { value: '3', label: t('eventmap.District', 'Distriktstävling') },
  { value: '4', label: t('eventmap.Near', 'Närtävling') },
  { value: '5', label: t('eventmap.Club', 'Klubbtävling') },
  { value: '6', label: t('eventmap.International', 'Internationell tävling') },
];

const eventStatusOptions = (t: (key: string, def: string) => string) => [
  { value: '1', label: t('eventmap.Applied', 'Ansökt') },
  { value: '2', label: t('eventmap.ApprovedByRegion', 'Godkänd av distriktet') },
  { value: '3', label: t('eventmap.Approved', 'Godkänd') },
  { value: '4', label: t('eventmap.Created', 'Skapad') },
  { value: '5', label: t('eventmap.EntryOpened', 'Anmälan öppnad') },
  { value: '6', label: t('eventmap.EntryPaused', 'Anmälan pausad') },
  { value: '7', label: t('eventmap.EntryClosed', 'Anmälan stängd') },
  { value: '8', label: t('eventmap.Live', 'Live') },
  { value: '9', label: t('eventmap.Completed', 'Genomförd') },
  { value: '10', label: t('eventmap.Canceled', 'Inställt') },
  { value: '11', label: t('eventmap.Reported', 'Rapporterad') },
];

const EventMapAdmin = observer(() => {
  const { t } = useTranslation();
  const { clubModel, sessionModel } = useMobxStore();
  const [form] = Form.useForm<IEventForm>();

  const [events, setEvents] = useState<IEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Which events to include when syncing: only completed, or all statuses.
  const [syncOnlyCompleted, setSyncOnlyCompleted] = useState(true);

  const moduleConfig = useMemo(
    () => clubModel.modules.find((m) => m.name === 'EventMap'),
    [clubModel.modules]
  );

  const isAdmin = sessionModel.isAdmin;

  const watchedLongitude = Form.useWatch('longitude', form);
  const watchedLatitude = Form.useWatch('latitude', form);

  const onPickLocation = useCallback(
    (longitude: number, latitude: number) => {
      form.setFieldsValue({ longitude, latitude });
    },
    [form]
  );

  // ── Load all events from the database ────────────
  const reload = useCallback(async () => {
    const queryUrl = moduleConfig?.queryUrl;
    if (!queryUrl) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const rows = await PostJsonData<IEventRow[]>(queryUrl, {}, true);
      setEvents(rows ?? []);
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig?.queryUrl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Sync from Eventor into the database ──────────
  const onSyncFromEventor = useCallback(async (onlyCompleted: boolean) => {
    const eventor = clubModel.eventor;
    const proxy = clubModel.eventorCorsProxy;
    const saveUrl = moduleConfig?.addUrl ?? moduleConfig?.updateUrl;
    const organisationId = eventor?.organisationId;

    if (!eventor?.eventsUrl || !proxy || !organisationId || !saveUrl) {
      message.error(t('eventmap.SyncMisconfig', 'Eventor eller lagrings-URL saknas i konfigurationen.'));
      return;
    }

    setSyncing(true);
    try {
      const fromDate = '2010-01-01 00:00:00';
      const toDate = new Date().toISOString().slice(0, 10) + ' 23:59:59';
      const eventsQueryUrl =
        `${eventor.eventsUrl}?organisationIds=${organisationId}` +
        `&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;

      const eventsJson = await PostJsonData<IEventorEvents>(
        proxy,
        { csurl: encodeURIComponent(eventsQueryUrl) },
        true
      );

      const eventList = toArray(eventsJson?.Event);

      // Map events that have coordinates. Start count is fetched per event
      // from the entries endpoint (number of entries ≈ starters).
      const rows: IEventRow[] = [];
      for (const ev of eventList) {
        // Skip non-completed events when the user chose "only completed".
        if (onlyCompleted && !isCompleted(ev)) continue;

        const coords = extractCoords(ev);
        if (!coords) continue;

        let startCount: number | null = null;
        // Eventor's /api/results/event returns ClassResult elements whose
        // numberOfStarts attribute sums to the event-wide starter count shown
        // on the event page. Derive the URL from the configured resultUrl
        // (.../api/results/organisation -> .../api/results/event).
        const resultEventUrl = eventor.resultUrl?.replace(/\/results\/organisation$/, '/results/event');
        if (resultEventUrl) {
          try {
            const resultsUrl = `${resultEventUrl}?eventId=${ev.EventId}&includeSplitTimes=false`;
            const resultsJson = await PostJsonData<IEventorResults | IEventorResults[]>(
              proxy,
              { csurl: encodeURIComponent(resultsUrl) },
              true
            );
            startCount = countStarters(resultsJson);
          } catch {
            // results not available (e.g. event not yet held) – leave as null
          }
        }

        rows.push({
          eventId: ev.EventId,
          source: 'eventor',
          name: ev.Name,
          date: ev.StartDate?.Date ?? null,
          classificationId: ev.EventClassificationId ?? null,
          longitude: coords[0],
          latitude: coords[1],
          startCount,
          url: `${eventor.url}/Show/${ev.EventId}`,
          orderBy: 0,
          eventStatus: ev.EventStatusId ?? null,
        });
      }

      if (rows.length === 0) {
        message.info(t('eventmap.SyncNothing', 'Inga arrangemang med koordinater hittades i Eventor.'));
        setSyncing(false);
        return;
      }

      await PostJsonData(
        saveUrl,
        {
          events: rows,
          removedEventIds: [],
          username: sessionModel.username,
          password: sessionModel.password,
        },
        true,
        sessionModel.authorizationHeader
      );

      message.success(
        t('eventmap.Synced', '{{count}} arrangemang synkades från Eventor', { count: rows.length })
      );
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSyncing(false);
    }
  }, [clubModel.eventor, clubModel.eventorCorsProxy, moduleConfig, sessionModel, reload, t]);

  // ── Save a single legacy event (add or update) ──
  const onSave = useCallback(
    async (values: IEventForm) => {
      const saveUrl = moduleConfig?.addUrl ?? moduleConfig?.updateUrl;
      if (!saveUrl) return;
      setSaving(true);
      try {
        const dateStr = values.date == null ? null : values.date.format('YYYY-MM-DD');

        const payload: IEventRow = {
          eventId: values.eventId.trim(),
          source: 'legacy',
          name: values.name.trim(),
          date: dateStr,
          classificationId: values.classificationId || null,
          longitude: Number(values.longitude),
          latitude: Number(values.latitude),
          startCount: values.startCount == null ? null : Number(values.startCount),
          url: values.url?.trim() ? values.url.trim() : null,
          orderBy: values.orderBy ?? 0,
          eventStatus: values.eventStatus ?? null,
        };

        await PostJsonData(
          saveUrl,
          {
            events: [payload],
            removedEventIds: [],
            username: sessionModel.username,
            password: sessionModel.password,
          },
          true,
          sessionModel.authorizationHeader
        );

        message.success(t('eventmap.Saved', 'Arrangemanget sparades'));
        form.resetFields();
        await reload();
      } catch (e) {
        if (e instanceof Error && e.message) message.error(e.message);
      } finally {
        setSaving(false);
      }
    },
    [moduleConfig, sessionModel, form, reload, t]
  );

  // ── Delete an event (legacy or a synced eventor row) ──
  const onDelete = useCallback(
    async (row: IEventRow) => {
      const deleteUrl = moduleConfig?.deleteUrl;
      if (!deleteUrl) return;
      try {
        await PostJsonData(
          deleteUrl,
          {
            eventId: row.eventId,
            source: row.source,
            username: sessionModel.username,
            password: sessionModel.password,
          },
          true,
          sessionModel.authorizationHeader
        );
        message.success(t('eventmap.Deleted', 'Arrangemanget togs bort'));
        await reload();
      } catch (e) {
        if (e instanceof Error && e.message) message.error(e.message);
      }
    },
    [moduleConfig, sessionModel, reload, t]
  );

  const editRow = useCallback(
    (row: IEventRow) => {
      form.setFieldsValue({
        eventId: row.eventId,
        name: row.name,
        date: row.date ? dayjs(row.date) : null,
        classificationId: row.classificationId,
        longitude: row.longitude,
        latitude: row.latitude,
        startCount: row.startCount,
        url: row.url,
        orderBy: row.orderBy,
        eventStatus: row.eventStatus,
      });
    },
    [form]
  );

  if (!isAdmin) {
    return <div>{t('eventmap.AdminOnly', 'Endast administratörer kan redigera arrangemang.')}</div>;
  }

  const columns = [
    {
      title: t('eventmap.Source', 'Källa'),
      dataIndex: 'source',
      key: 'source',
      render: (s: IEventRow['source']) =>
        s === 'eventor' ? <Tag color="blue">Eventor</Tag> : <Tag color="purple">{t('eventmap.Legacy', 'Äldre')}</Tag>,
    },
    { title: t('eventmap.Name', 'Namn'), dataIndex: 'name', key: 'name' },
    { title: t('eventmap.Date', 'Datum'), dataIndex: 'date', key: 'date' },
    { title: t('eventmap.Starts', 'Starter'), dataIndex: 'startCount', key: 'startCount' },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, row: IEventRow) => (
        <>
          {row.source === 'legacy' && (
            <Button size="small" onClick={() => editRow(row)} style={{ marginRight: 8 }}>
              {t('common.Edit', 'Redigera')}
            </Button>
          )}
          <Popconfirm title={t('eventmap.ConfirmDelete', 'Ta bort arrangemanget?')} onConfirm={() => onDelete(row)}>
            <Button size="small" danger>
              {t('common.Delete', 'Ta bort')}
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Radio.Group
          value={syncOnlyCompleted}
          onChange={(e) => setSyncOnlyCompleted(e.target.value)}
        >
          <Radio value={true}>
            {t('eventmap.SyncOnlyCompleted', 'Bara genomförda arrangemang')}
          </Radio>
          <Radio value={false}>
            {t('eventmap.SyncAllStatuses', 'Alla arrangemang oavsett status')}
          </Radio>
        </Radio.Group>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Popconfirm
            title={
              syncOnlyCompleted
                ? t('eventmap.ConfirmSyncCompleted', 'Hämta genomförda arrangemang från Eventor och uppdatera databasen?')
                : t('eventmap.ConfirmSyncAll', 'Hämta alla arrangemang (oavsett status) från Eventor och uppdatera databasen?')
            }
            onConfirm={() => onSyncFromEventor(syncOnlyCompleted)}
          >
            <Button type="primary" loading={syncing}>
              {t('eventmap.SyncFromEventor', 'Synka från Eventor')}
            </Button>
          </Popconfirm>
          <span style={{ fontSize: 12, color: '#777' }}>
            {t(
              'eventmap.SyncHint',
              'Lägger till/uppdaterar Eventor-arrangemang. Äldre arrangemang som lagts in för hand påverkas inte.'
            )}
          </span>
        </div>
      </div>

      <h4>{t('eventmap.AddLegacy', 'Lägg till / redigera äldre arrangemang')}</h4>
      <Form form={form} layout="vertical" onFinish={onSave} initialValues={{ orderBy: 0 }}>
        <Form.Item
          name="eventId"
          label={t('eventmap.EventId', 'Id (unikt, t.ex. "legacy-1998-vinter")')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="name" label={t('eventmap.Name', 'Namn')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="date" label={t('eventmap.Date', 'Datum')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="classificationId" label={t('eventmap.Type', 'Tävlingstyp')}>
          <Select allowClear options={classificationOptions(t)} />
        </Form.Item>

        <Form.Item label={t('eventmap.PickOnMap', 'Välj plats på kartan')}>
          <LocationPickerMap
            longitude={typeof watchedLongitude === 'number' ? watchedLongitude : null}
            latitude={typeof watchedLatitude === 'number' ? watchedLatitude : null}
            onChange={onPickLocation}
            center={clubModel.map?.center}
            zoom={clubModel.map?.defaultZoomLevel ? Math.min(clubModel.map.defaultZoomLevel, 11) : 9}
          />
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
            {t('eventmap.PickHint', 'Klicka på kartan för att placera arrangemanget, eller dra markören för att finjustera.')}
          </div>
        </Form.Item>

        <Form.Item name="longitude" label={t('eventmap.Longitude', 'Longitud (WGS-84)')} rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} step={0.0001} />
        </Form.Item>
        <Form.Item name="latitude" label={t('eventmap.Latitude', 'Latitud (WGS-84)')} rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} step={0.0001} />
        </Form.Item>
        <Form.Item name="startCount" label={t('eventmap.StartCount', 'Antal startande')}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
        <Form.Item name="url" label={t('eventmap.Url', 'Länk (valfri)')}>
          <Input />
        </Form.Item>
        <Form.Item name="orderBy" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="eventStatus" label={t('eventmap.EventStatus', 'Arrangemangsstatus')}>
          <Select allowClear options={eventStatusOptions(t)} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('common.Save', 'Spara')}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => form.resetFields()}>
            {t('common.Clear', 'Rensa')}
          </Button>
        </Form.Item>
      </Form>

      <Table<IEventRow>
        rowKey={(r) => `${r.source}:${r.eventId}`}
        loading={loading}
        dataSource={events}
        columns={columns}
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
});

export default EventMapAdmin;
