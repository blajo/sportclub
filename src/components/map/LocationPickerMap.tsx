import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { defaults as defaultInteractions, Translate } from 'ol/interaction';
import Collection from 'ol/Collection';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import View from 'ol/View';
import 'ol/ol.css';
import { useEffect, useRef } from 'react';
import { styled } from 'styled-components';

const PickerContainer = styled.div`
  width: 100%;
  height: 320px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
`;

const markerStyle = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: 'rgba(120, 90, 160, 0.85)' }),
    stroke: new Stroke({ color: '#fff', width: 2.5 }),
  }),
});

export interface ILocationPickerMapProps {
  // Current value in WGS-84. null = nothing selected yet.
  longitude: number | null;
  latitude: number | null;
  // Fired on click or marker drag with the new WGS-84 coordinate.
  onChange: (longitude: number, latitude: number) => void;
  // Initial view centre/zoom (e.g. clubModel.map?.center).
  center?: number[];
  zoom?: number;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

const LocationPickerMap = ({ longitude, latitude, onChange, center, zoom = 9 }: ILocationPickerMapProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const featureRef = useRef<Feature<Point> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  // Keep latest onChange without re-creating the map.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasInitialPoint = longitude != null && latitude != null;

  // ── Build the map once ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    const source = new VectorSource();
    sourceRef.current = source;

    const feature = new Feature<Point>();
    feature.setStyle(markerStyle);
    if (hasInitialPoint) {
      feature.setGeometry(new Point(fromLonLat([longitude as number, latitude as number])));
      source.addFeature(feature);
    }
    featureRef.current = feature;

    const viewCenter = hasInitialPoint
      ? fromLonLat([longitude as number, latitude as number])
      : fromLonLat(center ?? [15.5, 62.5]);

    const map = new Map({
      target: mapRef.current,
      interactions: defaultInteractions(),
      layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source })],
      view: new View({ center: viewCenter, zoom: hasInitialPoint ? Math.max(zoom, 11) : zoom }),
    });
    mapInstanceRef.current = map;

    // Click to place / move the marker.
    map.on('click', (e) => {
      const [lon, lat] = toLonLat(e.coordinate);
      if (!source.getFeatures().includes(feature)) source.addFeature(feature);
      feature.setGeometry(new Point(e.coordinate));
      onChangeRef.current(round6(lon), round6(lat));
    });

    // Drag the marker to fine-tune.
    const translate = new Translate({ features: new Collection([feature]) });
    translate.on('translateend', () => {
      const geom = feature.getGeometry();
      if (geom) {
        const [lon, lat] = toLonLat(geom.getCoordinates());
        onChangeRef.current(round6(lon), round6(lat));
      }
    });
    map.addInteraction(translate);

    map.getViewport().style.cursor = 'crosshair';

    return () => {
      map.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync marker when the form value changes externally (e.g. editing a row) ──
  useEffect(() => {
    const source = sourceRef.current;
    const feature = featureRef.current;
    const map = mapInstanceRef.current;
    if (!source || !feature || !map) return;

    if (longitude == null || latitude == null) {
      if (source.getFeatures().includes(feature)) source.removeFeature(feature);
      return;
    }

    const coordinate = fromLonLat([longitude, latitude]);
    feature.setGeometry(new Point(coordinate));
    if (!source.getFeatures().includes(feature)) source.addFeature(feature);
  }, [longitude, latitude]);

  return <PickerContainer ref={mapRef} />;
};

export default LocationPickerMap;
