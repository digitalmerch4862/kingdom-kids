
import React, { useState, useEffect } from 'react';
import { db } from '../services/db.service';
import { audio } from '../services/audio.service';
import { X, Save, UserPlus, GraduationCap, Loader2 } from 'lucide-react';

interface ManualEntryFormProps {
  initialType?: 'alumni' | 'guest';
  onClose: () => void;
  onSuccess?: () => void;
}

const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ initialType = 'guest', onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'alumni' | 'guest'>(initialType);
  const [role, setRole] = useState('');
  const [batch, setBatch] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus(initialType);
  }, [initialType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("Paki-lagay ang pangalan!");
      return;
    }
    
    setLoading(true);
    setError('');
    audio.playClick();

    try {
      await db.addManualRecord({
        name: name.toUpperCase(),
        status,
        role: status === 'alumni' ? (role || 'Alumni') : 'Guest',
        batch: status === 'alumni' ? batch : '',
        guardianContact: contact
      });
      
      audio.playYehey();
      alert('Tagumpay! Na-save na ang record.');
      setName(''); 
      setRole(''); 
      setBatch('');
      setContact('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError('May error sa pag-save: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-pink-500 p-8 text-white relative">
        <div className="flex items-center gap-3 mb-1">
          {status === 'alumni' ? <GraduationCap size={24} /> : <UserPlus size={24} />}
          <h2 className="text-2xl font-black uppercase tracking-tighter">Manual Registration</h2>
        </div>
        <p className="text-pink-100 text-[10px] font-black uppercase tracking-widest opacity-80">
          {status === 'alumni' ? 'Pag-rehistro ng Alumni o Guro' : 'Pag-rehistro ng Walk-in Guest'}
        </p>
        <button 
          onClick={() => { audio.playClick(); onClose(); }} 
          className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
        >
          <X size={28} />
        </button>
      </div>

      <form onSubmit={handleSave} className="p-8 space-y-5">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name (Pangalan)</label>
          <input 
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 uppercase"
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="JUAN DELA CRUZ" 
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Member Type (Kategorya)</label>
          <select 
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 appearance-none cursor-pointer"
            value={status} 
            onChange={(e) => setStatus(e.target.value as any)}
            disabled={loading}
          >
            <option value="guest">Guest / Walk-in</option>
            <option value="alumni">Alumni / Teacher</option>
          </select>
        </div>

        {status === 'alumni' && (
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Role</label>
              <input 
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700"
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                placeholder="Teacher" 
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Batch Year</label>
              <input 
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700"
                value={batch} 
                onChange={(e) => setBatch(e.target.value)} 
                placeholder="2015" 
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Number (Optional)</label>
          <input 
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700"
            value={contact} 
            onChange={(e) => setContact(e.target.value)} 
            placeholder="09XXXXXXXXX" 
            disabled={loading}
          />
        </div>

        {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-in shake">{error}</p>}

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-5 rounded-[1.5rem] transition-all shadow-xl shadow-pink-100 flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Sinasave ang record...
            </>
          ) : (
            <>
              <Save size={18} /> I-save ang Member
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
