import { Button, Select, Spin, Tag } from 'antd';
import { observer } from 'mobx-react';
import Feature, { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import 'ol/ol.css';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import View from 'ol/View';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { IThemeProps } from '../../models/mobxClubModel';
import { PostJsonData } from '../../utils/api';
import { useMobxStore } from '../../utils/mobxStore';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Coords = [number, number]; // [lon, lat]

interface IClubEvent {
  id: string;
  name: string;
  date: string | null;
  classificationId: string | null;
  coords: Coords;
  startCount: number | null;
  url: string;
  source: 'eventor' | 'legacy';
  eventStatus: string | null;
}

// Row shape returned by jsonEventMapQuery.php (both eventor and legacy events)
interface IEventRow {
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

interface IPopupData {
  name: string;
  date: string | null;
  startCount: number | null;
  url: string;
  classificationId: string | null;
  eventStatus: string | null;
}

// ─────────────────────────────────────────────
// OpenLayers style factories
// ─────────────────────────────────────────────
const radiusFor = (count: number): number => (count ? Math.min(6 + Math.sqrt(count) * 0.8, 18) : 7);

const markerStyle = (count: number, color: string, hovered = false): Style =>
  new Style({
    image: new CircleStyle({
      radius: radiusFor(count) + (hovered ? 3 : 0),
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: hovered ? 2.5 : 2 }),
    }),
    text:
      count > 0
        ? new Text({
            text: String(count),
            fill: new Fill({ color: '#fff' }),
            font: `bold ${hovered ? 12 : 11}px sans-serif`,
            offsetY: 1,
          })
        : undefined,
  });

const MARKER_COLOR = 'rgba(30, 120, 200, 0.82)';
const HOVER_COLOR = 'rgba(220, 80, 40, 0.9)';
const LEGACY_COLOR = 'rgba(120, 90, 160, 0.82)';

// ─────────────────────────────────────────────
// Styled components
// ─────────────────────────────────────────────
const Wrapper = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  background-color: #ffffff;
`;

const Header = styled.div<{ theme: IThemeProps }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.palette.primary.main};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  font-weight: 600;
  font-size: 15px;
`;

const Filters = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #ebebeb;
  flex-wrap: wrap;
`;

const MapWrap = styled.div`
  position: relative;
  height: 520px;
`;

const MapContainer = styled.div`
  width: 100%;
  height: 100%;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const Popup = styled.div`
  position: absolute;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  padding: 12px 14px 10px;
  min-width: 210px;
  max-width: 280px;
`;

const PopupClose = styled.button`
  position: absolute;
  top: 4px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: #888;
  line-height: 1;
`;

const PopupName = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin: 0 18px 6px 0;
  line-height: 1.35;
`;

const PopupMeta = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #f9f9f9;
  border-top: 1px solid #ebebeb;
  font-size: 12px;
  color: #666;
`;

const Dot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  background-color: ${MARKER_COLOR};
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
`;

const LegacyDot = styled(Dot)`
  background-color: ${LEGACY_COLOR};
`;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const EventMap = observer(() => {
  const { t } = useTranslation();
  const { clubModel, globalStateModel, sessionModel } = useMobxStore();
  const navigate = useNavigate();

  const mapRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const hoveredFeatureRef = useRef<Feature | null>(null);

  const [events, setEvents] = useState<IClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<IPopupData | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const classLabels = useMemo<Record<string, string>>(
    () => ({
      '1': t('eventmap.Championship', 'Mästerskapstävling'),
      '2': t('eventmap.National', 'Nationell tävling'),
      '3': t('eventmap.District', 'Distriktstävling'),
      '4': t('eventmap.Near', 'Närtävling'),
      '5': t('eventmap.Club', 'Klubbtävling'),
      '6': t('eventmap.International', 'Internationell tävling'),
    }),
    [t]
  );

  const eventStatusLabels = useMemo<Record<string, string>>(
    () => ({
      '1': t('eventmap.Applied', 'Ansökt'),
      '2': t('eventmap.ApprovedByRegion', 'Godkänd av distriktet'),
      '3': t('eventmap.Approved', 'Godkänd'),
      '4': t('eventmap.Created', 'Skapad'),
      '5': t('eventmap.EntryOpened', 'Anmälan öppnad'),
      '6': t('eventmap.EntryPaused', 'Anmälan pausad'),
      '7': t('eventmap.EntryClosed', 'Anmälan stängd'),
      '8': t('eventmap.Live', 'Live'),
      '9': t('eventmap.Completed', 'Genomförd'),
      '10': t('eventmap.Canceled', 'Inställt'),
      '11': t('eventmap.Reported', 'Rapporterad'),
    }),
    [t]
  );

  // ── Fetch all events from the club database (eventor + legacy) ──
  useEffect(() => {
    let cancelled = false;
    const queryUrl = clubModel.modules.find((m) => m.name === 'EventMap')?.queryUrl;

    if (!queryUrl) {
      setError(t('eventmap.MissingConfig', 'EventMap är inte konfigurerat för klubben.'));
      setLoading(false);
      return;
    }

    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const rows = await PostJsonData<IEventRow[]>(queryUrl, {}, true);
        const mapped: IClubEvent[] = (rows ?? []).map((r) => ({
          id: r.eventId,
          name: r.name,
          date: r.date,
          classificationId: r.classificationId,
          coords: [r.longitude, r.latitude] as Coords,
          startCount: r.startCount,
          url: r.url ?? '',
          source: r.source,
          eventStatus: r.eventStatus ?? null,
        }));

        if (!cancelled) {
          setEvents(mapped);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [clubModel.modules, t]);

  // ── Derived filter data ──────────────────────────
  const years = useMemo(
    () =>
      [...new Set(events.map((e) => e.date?.slice(0, 4)).filter((y): y is string => Boolean(y)))]
        .sort()
        .reverse(),
    [events]
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        const classOk = classFilter === 'all' || e.classificationId === classFilter;
        const yearOk = yearFilter === 'all' || (e.date?.startsWith(yearFilter) ?? false);
        return classOk && yearOk;
      }),
    [events, classFilter, yearFilter]
  );

  // ── Initialise OpenLayers map (once) ─────────────
  useEffect(() => {
    if (!mapRef.current || !popupRef.current) return;

    const source = new VectorSource();
    vectorSourceRef.current = source;

    const map = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source })],
      view: new View({
        center: fromLonLat(clubModel.map?.center ?? [15.5, 62.5]),
        zoom: 5,
      }),
    });

    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: { animation: { duration: 250 } },
      positioning: 'bottom-center',
      offset: [0, -14],
    });
    map.addOverlay(overlay);
    overlayRef.current = overlay;
    mapInstanceRef.current = map;

    map.on('pointermove', (e) => {
      const prev = hoveredFeatureRef.current;
      let hit: Feature | null = null;
      map.forEachFeatureAtPixel(e.pixel, (f: FeatureLike) => {
        hit = f as Feature;
        return true;
      });
      if (prev && prev !== hit) {
        const baseColor = prev.get('source') === 'legacy' ? LEGACY_COLOR : MARKER_COLOR;
        prev.setStyle(markerStyle((prev.get('startCount') as number) || 0, baseColor));
      }
      if (hit && hit !== prev) {
        const feature = hit as Feature;
        feature.setStyle(markerStyle((feature.get('startCount') as number) || 0, HOVER_COLOR, true));
      }
      hoveredFeatureRef.current = hit;
      map.getViewport().style.cursor = hit ? 'pointer' : '';
    });

    map.on('click', (e) => {
      let hit: Feature | null = null;
      map.forEachFeatureAtPixel(e.pixel, (f: FeatureLike) => {
        hit = f as Feature;
        return true;
      });
      if (!hit) {
        overlay.setPosition(undefined);
        setPopup(null);
        return;
      }
      const feature = hit as Feature;
      overlay.setPosition(e.coordinate);
      setPopup({
        name: feature.get('name') as string,
        date: feature.get('date') as string | null,
        startCount: feature.get('startCount') as number | null,
        url: feature.get('url') as string,
        classificationId: feature.get('classificationId') as string | null,
        eventStatus: feature.get('eventStatus') as string | null,
      });
    });

    return () => {
      map.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync features with filtered events ───────────
  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) return;

    source.clear();
    const features = filtered.map((ev) => {
      const f = new Feature({
        geometry: new Point(fromLonLat(ev.coords)),
        eventId: ev.id,
        name: ev.name,
        date: ev.date,
        startCount: ev.startCount,
        url: ev.url,
        classificationId: ev.classificationId,
        source: ev.source,
        eventStatus: ev.eventStatus,
      });
      // Legacy events use a distinct colour so they stand out from Eventor events.
      f.setStyle(markerStyle(ev.startCount ?? 0, ev.source === 'legacy' ? LEGACY_COLOR : MARKER_COLOR));
      return f;
    });
    source.addFeatures(features);

    if (features.length > 0 && mapInstanceRef.current) {
      const extent = source.getExtent();
      if (extent) {
        mapInstanceRef.current.getView().fit(extent, {
          padding: [60, 60, 60, 60],
          maxZoom: 14,
          duration: 500,
        });
      }
    }
  }, [filtered]);

  const closePopup = useCallback(() => {
    overlayRef.current?.setPosition(undefined);
    setPopup(null);
  }, []);

  return (
    <Wrapper>
      <Header>
        <span>{t('eventmap.Title', 'Arrangemang')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sessionModel.isAdmin && (
            <Button
              size="small"
              onClick={() => globalStateModel.setDashboard(navigate, '/eventmap/admin')}
            >
              {t('eventmap.ManageEvents', 'Hantera arrangemang')}
            </Button>
          )}
          <Tag style={{ marginRight: 0 }}>
            {filtered.length} {t('eventmap.Places', 'platser')}
          </Tag>
        </span>
      </Header>

      <Filters>
        <Select
          value={classFilter}
          onChange={setClassFilter}
          style={{ minWidth: 180 }}
          options={[
            { value: 'all', label: t('eventmap.AllTypes', 'Alla tävlingstyper') },
            ...Object.entries(classLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={yearFilter}
          onChange={setYearFilter}
          style={{ minWidth: 120 }}
          options={[
            { value: 'all', label: t('eventmap.AllYears', 'Alla år') },
            ...years.map((y) => ({ value: y, label: y })),
          ]}
        />
      </Filters>

      <MapWrap>
        {loading && (
          <LoadingOverlay>
            <Spin size="large" />
            <div>{t('eventmap.Loading', 'Hämtar arrangemang från Eventor…')}</div>
          </LoadingOverlay>
        )}
        {error && !loading && (
          <LoadingOverlay style={{ background: 'rgba(200,50,50,0.9)', color: '#fff' }}>
            <div style={{ fontWeight: 500 }}>{t('eventmap.Error', 'Kunde inte hämta data')}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{error}</div>
          </LoadingOverlay>
        )}

        <MapContainer ref={mapRef} />

        <Popup ref={popupRef}>
          {popup && (
            <>
              <PopupClose onClick={closePopup} aria-label={t('common.Close', 'Stäng')}>
                ×
              </PopupClose>
              <PopupName>{popup.name}</PopupName>
              <PopupMeta>
                <span>{popup.date || t('eventmap.UnknownDate', 'Okänt datum')}</span>
                {popup.startCount != null && (
                  <Tag color="blue" style={{ marginRight: 0 }}>
                    {popup.startCount} {t('eventmap.Starts', 'starter')}
                  </Tag>
                )}
              </PopupMeta>
              {popup.classificationId && classLabels[popup.classificationId] && (
                <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
                  {classLabels[popup.classificationId]}
                </div>
              )}
              {popup.eventStatus != null && eventStatusLabels[popup.eventStatus] && (
                <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
                  {t('eventmap.Status', 'Status')}: <em>{eventStatusLabels[popup.eventStatus]}</em>
                </div>
              )}
              {popup.url && (
                <a href={popup.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                  {t('eventmap.OpenInEventor', 'Öppna i Eventor')} ↗
                </a>
              )}
            </>
          )}
        </Popup>
      </MapWrap>

      <Legend>
        <Dot />
        <span>{t('eventmap.LegendEventor', 'Eventor-arrangemang')}</span>
        <LegacyDot style={{ marginLeft: 12 }} />
        <span>{t('eventmap.LegendLegacy', 'Äldre arrangemang (före Eventor)')}</span>
      </Legend>
    </Wrapper>
  );
});

export default EventMap;
