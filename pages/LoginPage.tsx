
import React, { useState, useMemo, useEffect } from 'react';
import { AUTH_PASSWORDS } from '../constants';
import { UserRole, AgeGroup } from '../types';
import { audio } from '../services/audio.service';
import { db } from '../services/db.service';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Student";
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  return fullName.split(' ')[0];
};

interface LoginPageProps {
  onLogin: (role: UserRole, username: string, studentId?: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('KK-');
  const [role, setRole] = useState<'TEACHER' | 'PARENTS'>('PARENTS');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [isFading, setIsFading] = useState(false);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [regError, setRegError] = useState('');
  const [newAccessKey, setNewAccessKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    birthday: '',
    guardianName: '',
    guardianPhone: '09',
    notes: ''
  });

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsFading(true), 3000);
    const removeTimer = setTimeout(() => setShowSplash(false), 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const performAccessKeyLogin = async (key: string) => {
    // Normalization: Ensure key is clean and trimmed
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey || cleanKey === 'KK-') return;

    setIsVerifying(true);
    setError('');
    
    try {
      const student = await db.getStudentByNo(cleanKey);
      if (student) {
        audio.playYehey();
        onLogin('PARENTS', getFirstName(student.fullName).toUpperCase(), student.id);
      } else {
        audio.playClick();
        setError(`INVALID KEY: "${cleanKey}". PLEASE CHECK YOUR RECORD OR SIGN UP.`);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const checkTeacherAutoLogin = (inputPass: string, inputUser: string) => {
    const normalizedUser = inputUser.trim().toUpperCase();
    if (!normalizedUser) return;

    if (normalizedUser === 'RAD' && inputPass === AUTH_PASSWORDS.ADMIN) {
      audio.playYehey();
      onLogin('ADMIN', normalizedUser);
      return true;
    } else if (inputPass === AUTH_PASSWORDS.TEACHER) {
      audio.playYehey();
      onLogin('TEACHER', normalizedUser);
      return true;
    }
    return false;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setError('');
    checkTeacherAutoLogin(val, username);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    audio.playClick();
    if (!username) return setError('Username is required');
    if (!checkTeacherAutoLogin(password, username)) {
      setError('INVALID PASSWORD OR USERNAME');
    }
  };

  /**
   * Smarter formatting that allows non-numeric keys but still
   * assists with the standard KK-YYYYMMDD-SS pattern.
   */
  const handleAccessKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    let val = e.target.value.toUpperCase();
    
    // Auto-masking: only apply if the input looks like a date pattern
    const digitsOnly = val.replace(/[^0-9]/g, '');
    
    if (val.startsWith('KK-') && digitsOnly.length > 0) {
      // It's likely a standard key, format it nicely
      const raw = digitsOnly.substring(0, 10);
      let formatted = 'KK-';
      if (raw.length > 0) formatted += raw.substring(0, 8);
      if (raw.length > 8) formatted += '-' + raw.substring(8);
      
      // Update state
      setAccessKey(formatted);
      
      // Auto-trigger only on exactly 14 characters (the standard length)
      if (formatted.length === 14) {
        performAccessKeyLogin(formatted);
      }
    } else if (val === '' || val === 'K' || val === 'KK') {
      setAccessKey('KK-');
    } else {
      // Allow free typing for non-standard or custom keys (e.g., KK-DEMO-01)
      setAccessKey(val);
    }
  };

  const handleParentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    audio.playClick();
    
    const cleanInput = accessKey.trim();
    if (!cleanInput || cleanInput === 'KK-') {
      setError('PLEASE ENTER YOUR ACCESS KEY');
      return;
    }
    
    performAccessKeyLogin(cleanInput);
  };

  const ageData = useMemo(() => {
    if (!formData.birthday) return { age: 0, group: null, error: '' };
    const birthDate = new Date(formData.birthday);
    if (isNaN(birthDate.getTime())) return { age: 0, group: null, error: 'Invalid Date.' };
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 3 || age > 12) return { age, group: null, error: 'Age must be 3-12 years.' };
    let group: AgeGroup = "3-6";
    if (age >= 7 && age <= 9) group = "7-9";
    else if (age >= 10 && age <= 12) group = "10-12";
    return { age, group, error: '' };
  }, [formData.birthday]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setRegError('');
    audio.playClick();
    if (ageData.error) {
      setRegError(ageData.error);
      setIsSaving(false);
      return;
    }
    try {
      const result = await db.addStudent({
        fullName: formData.fullName.toUpperCase(),
        birthday: formData.birthday,
        guardianName: formData.guardianName.toUpperCase(),
        guardianPhone: formData.guardianPhone,
        notes: formData.notes,
        ageGroup: ageData.group!
      });
      const firstName = getFirstName(formData.fullName).toUpperCase();
      const smsMsg = `Welcome to Kingdom Kids! Student: ${firstName}, Access Key: ${result.access_key}. See you at the Kingdom! 👑`;
      window.location.href = "sms:" + formData.guardianPhone + "?body=" + encodeURIComponent(smsMsg);
      audio.playYehey();
      setNewAccessKey(result.access_key);
    } catch (err: any) {
      setRegError(err.message || "Registration failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#fdf2f8] relative">
      {showSplash && (
        <div className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
          <h1 className="text-4xl md:text-6xl font-black text-pink-500 uppercase tracking-tighter mb-8 animate-in zoom-in duration-700">Kingdom Kids</h1>
          <div className="flex gap-2 items-center">
            <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-bounce"></div>
            <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
            <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-pink-200/50 border border-pink-50 text-center animate-in fade-in zoom-in-95 duration-500">
          <h2 className="text-3xl font-black text-pink-500 mb-2 uppercase tracking-tighter">Kingdom Kids</h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-8">Access Portal</p>
          
          <div className="flex bg-gray-50 p-1 rounded-2xl mb-8 border border-gray-100">
            <button type="button" className={`flex-1 py-3 rounded-xl text-xs font-black transition-all tracking-widest uppercase ${role === 'PARENTS' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-pink-400'}`} onClick={() => setRole('PARENTS')}>Parents/Student</button>
            <button type="button" className={`flex-1 py-3 rounded-xl text-xs font-black transition-all tracking-widest uppercase ${role === 'TEACHER' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-pink-400'}`} onClick={() => setRole('TEACHER')}>Teacher</button>
          </div>

          {role === 'TEACHER' ? (
            <form onSubmit={handleSubmit} className="space-y-5 text-left animate-in fade-in duration-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                <input 
                  type="text" 
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700 placeholder:text-gray-300"
                  value={username}
                  onChange={e => setUsername(e.target.value.toUpperCase())}
                  placeholder="ENTER YOUR NAME"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <input 
                  type="password" 
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mt-2 animate-in shake">{error}</p>}
              <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-pink-100 uppercase tracking-widest text-xs mt-6 active:scale-[0.98]">Login to Portal</button>
            </form>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleParentLoginSubmit} className="space-y-5 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-center">Your Access Key</label>
                  <input 
                    type="text" 
                    required 
                    disabled={isVerifying} 
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-black text-gray-700 placeholder:text-gray-300 text-center tracking-[0.25em] text-lg disabled:opacity-50" 
                    value={accessKey} 
                    onChange={handleAccessKeyChange} 
                    placeholder="KK-########-##" 
                  />
                  <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest text-center">{isVerifying ? 'VERIFYING KEY...' : 'ENTER YOUR UNIQUE ACCESS KEY'}</p>
                </div>
                {error && (
                  <div className="p-3 bg-red-50 rounded-xl animate-in shake">
                    <p className="text-red-500 text-[9px] font-black uppercase tracking-widest text-center leading-relaxed">{error}</p>
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isVerifying || accessKey.length < 5} 
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-pink-100 uppercase tracking-widest text-xs mt-4 active:scale-[0.98] disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none"
                >
                  {isVerifying ? 'CONNECTING...' : 'ENTER KINGDOM DASHBOARD'}
                </button>
              </form>
              <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-gray-100"></div><span className="flex-shrink mx-4 text-[8px] font-black text-gray-300 uppercase tracking-widest">OR</span><div className="flex-grow border-t border-gray-100"></div></div>
              <button onClick={() => { audio.playClick(); setShowRegisterModal(true); }} className="w-full py-6 text-pink-500 font-black text-xl uppercase tracking-widest hover:bg-pink-50 rounded-3xl transition-all border-4 border-pink-200 border-dashed shadow-lg">✨ Sign Up My Kids</button>
              <div className="mt-2 text-center"><button type="button" onClick={() => { audio.playClick(); onLogin('PARENTS', 'GUEST', 'GUEST_DEMO'); }} className="w-full bg-gray-100 text-black font-black py-4 rounded-2xl transition-all border-2 border-black text-lg uppercase tracking-widest hover:bg-gray-200 active:scale-[0.98]">Continue as Guest</button></div>
            </div>
          )}
        </div>
      </div>

      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-8 md:p-10 text-white relative">
              <h3 className="text-2xl font-black uppercase tracking-tighter">New Registration</h3>
              <p className="text-pink-100 text-[12px] font-black uppercase tracking-widest opacity-80">Join the Kingdom Kids family</p>
              {!newAccessKey && <button onClick={() => setShowRegisterModal(false)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors text-3xl font-black leading-none">&times;</button>}
            </div>
            <div className="p-8 md:p-10">
              {newAccessKey ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg border-4 border-white">✓</div>
                  <h4 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Success!</h4>
                  <div className="bg-pink-50 p-6 rounded-2xl border-2 border-dashed border-pink-200 inline-block mt-4">
                    <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Your Unique Access Key</p>
                    <p className="text-2xl font-black text-pink-600 tracking-widest">{newAccessKey}</p>
                  </div>
                  <button onClick={() => { setShowRegisterModal(false); setNewAccessKey(null); }} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[12px]">Return to Login</button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Kid's Nickname</label><input type="text" required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })} /></div>
                  <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Birthday</label><input type="date" required className="w-full px-6 py-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} /></div><div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Age Group</label><div className="w-full px-6 py-4 font-black border rounded-2xl flex items-center h-[58px] bg-pink-50 text-pink-600 border-pink-100">{ageData.group || '---'}</div></div></div>
                  <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Guardian Name</label><input type="text" required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700" value={formData.guardianName} onChange={e => setFormData({ ...formData, guardianName: e.target.value.toUpperCase() })} /></div>
                  <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact No.</label><input type="tel" required maxLength={11} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700" value={formData.guardianPhone} onChange={e => setFormData({ ...formData, guardianPhone: e.target.value })} /></div>
                  {regError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-in shake">{regError}</p>}
                  <div className="pt-4 flex gap-4"><button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 py-5 text-gray-400 font-black hover:bg-gray-50 rounded-2xl transition-all uppercase tracking-widest text-[11px]">Cancel</button><button type="submit" disabled={isSaving || !!ageData.error} className="flex-1 py-5 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[11px] disabled:opacity-50">{isSaving ? 'Processing...' : 'Confirm Sign Up'}</button></div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
