import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from './Toast';
import api from '../services/api';

const GlobalChecker = ({ onBirthdayToday }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { push } = useToast();
  const onBirthdayRef = useRef(onBirthdayToday);
  onBirthdayRef.current = onBirthdayToday;

  // ── Reminder check: every 60 seconds ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const { data } = await api.get('/private-space/reminders');
        const now = new Date();
        const nowDate = now.toISOString().split('T')[0];
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        data.forEach(r => {
          if (r.date !== nowDate || r.time !== nowTime) return;
          const key = `reminded_${r._id}_${r.date}_${r.time}`;
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
          push({ emoji: '⏰', title: 'Reminder!', body: r.text, duration: 8000 });
        });
      } catch { /* network errors are fine */ }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [user, push]);

  // ── Birthday check: once on load (2 s delay so app is ready) ──────
  useEffect(() => {
    if (!user || !socket) return;

    const check = async () => {
      try {
        const { data } = await api.get('/private-space/birthdays');
        const now = new Date();
        const year = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayMMDD = `${mm}-${dd}`;
        const todayISO = `${year}-${mm}-${dd}`;

        data.forEach(bday => {
          if (!bday.date) return;
          const parts = bday.date.split('-');
          let birthYear = null, month, day;
          if (parts.length === 3) {
            [birthYear, month, day] = parts;
          } else {
            [month, day] = parts;
          }
          const birthdayMMDD = `${month}-${day}`;
          const age = birthYear ? year - parseInt(birthYear, 10) : null;

          // ── TODAY is their birthday ──
          if (birthdayMMDD === todayMMDD) {
            const key = `bday_shown_${bday._id}_${year}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              onBirthdayRef.current({ friendId: bday.friendId, friendName: bday.friendName, age });
              // Tell the friend via socket
              if (bday.friendId) {
                socket.emit('wish_birthday', { targetUserId: bday.friendId, age, fromName: user.name });
              }
            }
            return;
          }

          // ── UPCOMING: 7 days or 1 day ──
          const bdayThisYear = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
          if (bdayThisYear < now) return; // already passed this year
          const daysUntil = Math.round((bdayThisYear - now) / 86_400_000);

          if (daysUntil === 7) {
            const key = `bday_7days_${bday._id}_${todayISO}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              push({
                emoji: '🎂',
                title: `${bday.friendName}'s birthday in 7 days!`,
                body: 'Get ready to wish them happy birthday 🎉',
                duration: 7000
              });
            }
          } else if (daysUntil === 1) {
            const key = `bday_1day_${bday._id}_${todayISO}`;
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              push({
                emoji: '🎂',
                title: `${bday.friendName}'s birthday is TOMORROW!`,
                body: "Don't forget to wish them! 🥳",
                duration: 9000
              });
            }
          }
        });
      } catch { /* silently ignore */ }
    };

    const t = setTimeout(check, 2000);
    return () => clearTimeout(t);
  }, [user, socket, push]);

  return null;
};

export default GlobalChecker;
