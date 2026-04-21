import { useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// baseUrl gives the page an HTTPS origin so the WebView allows CDN fetches.
// SRI integrity / crossorigin attributes are intentionally omitted — they
// require CORS preflight which fails from a WebView's null origin.
const MAP_BASE_URL = 'https://tile.openstreetmap.org';

function buildMapHTML(lat, lon) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}
    .ti{
      width:36px;height:36px;border-radius:50%;
      background:#fff;border:2.5px solid #7C3AED;
      display:flex;align-items:center;justify-content:center;
      font-size:20px;line-height:36px;text-align:center;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
      transition:transform .15s,background .15s;cursor:pointer;
    }
    .ti.sel{background:#EDE9FE;border-color:#5B21B6;transform:scale(1.25);}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false}).setView([${lat},${lon}],15);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  L.circle([${lat},${lon}],{
    radius:1500,color:'#7C3AED',weight:1.5,fillColor:'#8B5CF6',fillOpacity:.06
  }).addTo(map);

  L.circleMarker([${lat},${lon}],{
    radius:9,color:'#fff',weight:3,fillColor:'#4F46E5',fillOpacity:1
  }).addTo(map);

  var layer=L.layerGroup().addTo(map), els={};

  window.updateBathrooms=function(list){
    layer.clearLayers(); els={};
    list.forEach(function(b){
      var el=document.createElement('div');
      el.className='ti'; el.textContent='\uD83D\uDEBD';
      els[b.id]=el;
      L.marker([b.latitude,b.longitude],{
        icon:L.divIcon({html:el,className:'',iconSize:[36,36],iconAnchor:[18,36]})
      }).addTo(layer).on('click',function(){
        Object.values(els).forEach(function(e){e.classList.remove('sel');});
        el.classList.add('sel');
        window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(
          JSON.stringify({type:'SELECT',id:b.id})
        );
      });
    });
  };

  window.centerMap=function(){map.flyTo([${lat},${lon}],15,{duration:.5});};

  function onMsg(e){
    try{
      var d=JSON.parse(e.data);
      if(d.type==='BATHROOMS') window.updateBathrooms(d.bathrooms);
      if(d.type==='CENTER')    window.centerMap();
    }catch(err){}
  }
  document.addEventListener('message',onMsg);
  window.addEventListener('message',onMsg);
</script>
</body>
</html>`;
}

export default function MapScreen({ location, bathrooms, loading, onSelectBathroom }) {
  const webviewRef = useRef(null);

  const mapHtml = useMemo(
    () => location ? buildMapHTML(location.latitude, location.longitude) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location?.latitude, location?.longitude],
  );

  // Inject markers whenever bathrooms update or the map finishes loading
  const injectBathrooms = useCallback(() => {
    if (!webviewRef.current || !bathrooms.length) return;
    const payload = bathrooms.map(({ id, latitude, longitude }) => ({ id, latitude, longitude }));
    webviewRef.current.injectJavaScript(
      `window.updateBathrooms(${JSON.stringify(payload)});true;`
    );
  }, [bathrooms]);

  const handleMessage = useCallback((event) => {
    try {
      const { type, id } = JSON.parse(event.nativeEvent.data);
      if (type === 'SELECT') {
        const bathroom = bathrooms.find((b) => b.id === id);
        if (bathroom) onSelectBathroom(bathroom);
      }
    } catch {}
  }, [bathrooms, onSelectBathroom]);

  const centerOnUser = useCallback(() => {
    webviewRef.current?.injectJavaScript(`window.centerMap();true;`);
  }, []);

  // Re-inject when bathrooms change after the map is already loaded
  useEffect(() => {
    injectBathrooms();
  }, [injectBathrooms]);

  if (!location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html: mapHtml, baseUrl: MAP_BASE_URL }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        scalesPageToFit={false}
        onLoadEnd={injectBathrooms}
        onMessage={handleMessage}
        accessibilityLabel="Interactive map showing nearby restrooms"
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.loadingOverlayText}>Finding bathrooms...</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.centerBtn}
        onPress={centerOnUser}
        accessibilityRole="button"
        accessibilityLabel="Center map on my location"
      >
        <Ionicons name="locate" size={22} color="#7C3AED" accessibilityElementsHidden />
      </TouchableOpacity>

      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {bathrooms.length} restroom{bathrooms.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f4ff' },
  loadingText: { marginTop: 12, color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute', top: 16, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.93)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  loadingOverlayText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  centerBtn: {
    position: 'absolute', bottom: 24, right: 16,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 5,
  },
  countBadge: {
    position: 'absolute', bottom: 24, left: 16,
    backgroundColor: '#7C3AED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  countText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
