import React, { useCallback, useEffect, useState } from 'react';

const STEPS = {
  en: [
    {
      selector: '[data-tutorial="install"]',
      title: '📲 Add to Home Screen',
      body: 'Install Pastel Chat on your phone for faster access, better push notifications, and an app-like experience on iPhone & Android — no App Store needed!',
      position: 'above',
    },
    {
      selector: '[data-tutorial="telegram"]',
      title: '📱 Telegram Notifications',
      body: 'Connect your Telegram account to receive instant alerts for incoming calls, friend requests, and new messages — even when Pastel Chat is closed.',
      position: 'above',
    },
    {
      selector: '[data-tutorial="features"]',
      title: '🌸 Everything in One Place',
      body: 'Chat with friends, join group conversations, share photos, make voice & video calls, customize your avatar, organize your Private Space — it\'s all here waiting for you!',
      position: 'below',
    },
  ],
  vi: [
    {
      selector: '[data-tutorial="install"]',
      title: '📲 Thêm vào Màn hình Chính',
      body: 'Cài Pastel Chat lên điện thoại để truy cập nhanh hơn, nhận thông báo tốt hơn và trải nghiệm như ứng dụng thật trên iPhone & Android — không cần App Store!',
      position: 'above',
    },
    {
      selector: '[data-tutorial="telegram"]',
      title: '📱 Thông báo Telegram',
      body: 'Kết nối Telegram để nhận thông báo tức thì về cuộc gọi đến, yêu cầu kết bạn và tin nhắn mới — ngay cả khi Pastel Chat đang đóng.',
      position: 'above',
    },
    {
      selector: '[data-tutorial="features"]',
      title: '🌸 Tất cả trong Một nơi',
      body: 'Nhắn tin với bạn bè, tham gia nhóm chat, chia sẻ ảnh, gọi thoại & video, tùy chỉnh avatar, quản lý Không gian Riêng tư — tất cả đều có ở đây!',
      position: 'below',
    },
  ],
};

const PAD = 10;

const OnboardingTutorial = ({ lang = 'vi', onComplete }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const steps = STEPS[lang] || STEPS.en;
  const current = steps[step];

  const updateRect = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      left: r.left - PAD,
      top: r.top - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      centerX: r.left + r.width / 2,
      bottom: r.bottom + PAD,
    });
  }, [current]);

  useEffect(() => {
    // Small delay to let layout settle after step change
    const t1 = setTimeout(updateRect, 80);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(t1);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const finish = useCallback(() => {
    localStorage.setItem('pastel_onboarding_done', '1');
    onComplete();
  }, [onComplete]);

  const next = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Tooltip sizing & positioning
  const tooltipW = Math.min(300, vw - 32);
  let tooltipX = rect.centerX - tooltipW / 2;
  tooltipX = Math.max(16, Math.min(tooltipX, vw - tooltipW - 16));

  const TOOLTIP_H_ESTIMATE = 200;
  const showBelow = rect.top > vh / 2 || current.position === 'above'
    ? false
    : true;

  let tooltipY = showBelow
    ? rect.bottom + 12
    : rect.top - TOOLTIP_H_ESTIMATE - 12;
  tooltipY = Math.max(12, Math.min(tooltipY, vh - TOOLTIP_H_ESTIMATE - 12));

  // Arrow direction
  const arrowDown = !showBelow;

  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const labelNext = isLast
    ? (lang === 'vi' ? '✓ Xong!' : '✓ Done!')
    : (lang === 'vi' ? 'Tiếp →' : 'Next →');
  const labelBack = lang === 'vi' ? '← Lại' : '← Back';
  const labelSkip = lang === 'vi' ? 'Bỏ qua' : 'Skip';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>
      {/* Spotlight: positioned over target element; box-shadow dims everything else */}
      <div
        key={`spot-${step}`}
        style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.74)',
          zIndex: 9001,
          pointerEvents: 'none',
          animation: 'spotlightPulse 2.2s ease-in-out infinite',
          transition: 'left 0.38s cubic-bezier(0.4,0,0.2,1), top 0.38s cubic-bezier(0.4,0,0.2,1), width 0.38s, height 0.38s',
        }}
      />

      {/* Tooltip card */}
      <div
        key={`tip-${step}`}
        style={{
          position: 'fixed',
          left: tooltipX,
          top: tooltipY,
          width: tooltipW,
          background: 'linear-gradient(160deg, #1e1a35 0%, #251f3e 100%)',
          border: '1.5px solid rgba(221,160,221,0.38)',
          borderRadius: 18,
          padding: '18px 18px 14px',
          boxShadow: '0 16px 56px rgba(0,0,0,0.75)',
          zIndex: 9002,
          pointerEvents: 'all',
          animation: 'tooltipSlideIn 0.38s cubic-bezier(0.34,1.52,0.64,1) both',
        }}
      >
        {/* Arrow pointing toward spotlight */}
        <div style={{
          position: 'absolute',
          left: '50%', transform: 'translateX(-50%)',
          ...(arrowDown
            ? { bottom: -10, borderTop: '10px solid rgba(221,160,221,0.38)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }
            : { top: -10, borderBottom: '10px solid rgba(221,160,221,0.38)', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }
          ),
          width: 0, height: 0,
        }} />

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 4,
              background: i <= step
                ? 'linear-gradient(90deg, #FFB6C1, #DDA0DD)'
                : 'rgba(255,255,255,0.1)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <p style={{ margin: '0 0 3px', fontSize: 10, color: '#6b5a8a', letterSpacing: '0.06em' }}>
          {step + 1} / {steps.length}
        </p>

        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#f5eeff', lineHeight: 1.3 }}>
          {current.title}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#b09acc', lineHeight: 1.55 }}>
          {current.body}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{
              padding: '7px 13px', fontSize: 12,
              background: 'transparent',
              border: '1.5px solid rgba(221,160,221,0.22)',
              borderRadius: 9, color: '#7a6a90',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{labelSkip}</button>

          {!isFirst && (
            <button
              onClick={back}
              style={{
                padding: '7px 13px', fontSize: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(221,160,221,0.22)',
                borderRadius: 9, color: '#c4a3dc',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{labelBack}</button>
          )}

          <button
            onClick={next}
            style={{
              flex: 1, padding: '9px 14px', fontSize: 13,
              background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
              border: 'none', borderRadius: 10,
              color: 'white', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(221,160,221,0.45)',
            }}
          >{labelNext}</button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
