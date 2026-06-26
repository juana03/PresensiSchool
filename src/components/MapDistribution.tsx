import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SimulatedRecord, StudentAttendance, TeacherAttendance } from '../types';
import { MapPin } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const schoolLocation = [-6.8837, 107.5451]; // Coord of SMK Tutwuri Handayani, Cimahi

interface MapDistributionProps {
  records: SimulatedRecord[];
}

export default function MapDistribution({ records }: MapDistributionProps) {
  // Extract coordinates
  const markers = records.map(r => {
    const data = r.data as StudentAttendance | TeacherAttendance;
    if (data.latitude !== null && data.longitude !== null && !isNaN(data.latitude) && !isNaN(data.longitude)) {
      return {
        id: r.id,
        lat: data.latitude,
        lng: data.longitude,
        name: data.nama,
        status: data.status,
        type: r.type,
      };
    }
    return null;
  }).filter(Boolean) as { id: string; lat: number; lng: number; name: string; status: string; type: string }[];

  const center: [number, number] = (schoolLocation as [number, number]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-5 sm:p-6 mb-8 select-none animate-fadeIn">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-5">
        <div className="p-2.5 bg-indigo-50 rounded-xl">
          <MapPin size={20} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">
            Distribusi Peta Kehadiran
          </h2>
          <span className="text-[11px] text-slate-400 font-semibold mt-1.5 block">
            Pemetaan titik lokasi check-in absensi (Radius Area Sekolah)
          </span>
        </div>
      </div>

      <div className="h-[400px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
        <MapContainer center={center} zoom={16} className="w-full h-full" style={{ zIndex: 1 }}>
          <TileLayer
            attribution='&amp;copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* School Radius Area */}
          <Circle 
            center={center as [number, number]} 
            radius={100} 
            pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.1, weight: 2 }} 
          />

          {markers.map((marker, idx) => (
            <Marker key={idx} position={[marker.lat, marker.lng]} icon={customMarkerIcon}>
              <Popup>
                <div className="text-[10px] font-sans">
                  <strong className="text-sm block mb-1">{marker.name}</strong>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${marker.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {marker.status}
                  </span>
                  <span className="ml-1 capitalize text-slate-500 font-semibold">
                    • {marker.type}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
