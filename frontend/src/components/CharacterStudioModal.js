import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import PastelIcon from './PastelIcon';
import { useToast, useConfirm } from './Toast';
import { useLang } from '../i18n';
import { resolveCharacterAvatar } from '../utils/characterAvatar';

const SUGGESTED_TRAITS = [
  'Playful', 'Caring', 'Gently Sarcastic', 'Shy',
  'Confident', 'Thoughtful', 'Stubborn', 'Gentle',
  'Witty', 'Curious', 'Daydreamer', 'Protective'
];

const CharacterStudioModal = ({ open, onClose, friend, friendId, onSaved }) => {
  const { t } = useLang();
  const { push } = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Character Studio Fields
  const [about, setAbout] = useState('');
  const [personality, setPersonality] = useState('');
  const [personalityTags, setPersonalityTags] = useState([]);
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [wordsUsed, setWordsUsed] = useState('');
  const [wordsAvoided, setWordsAvoided] = useState('');
  const [thoughtProcess, setThoughtProcess] = useState('');
  const [relationship, setRelationship] = useState('');
  const [lore, setLore] = useState('');
  const [shouldRules, setShouldRules] = useState('');
  const [shouldNotRules, setShouldNotRules] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('');
  const [examples, setExamples] = useState([]);

  // Preview Mode
  const [previewMessages, setPreviewMessages] = useState([]);
  const [previewInput, setPreviewInput] = useState('');
  const [previewSending, setPreviewSending] = useState(false);
  const previewScrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/ai/character/config')
      .then(({ data }) => {
        const c = data?.customConfig || {};
        setAbout(c.about || '');
        setPersonality(c.personality || '');
        setPersonalityTags(Array.isArray(c.personalityTags) ? c.personalityTags : []);
        setSpeakingStyle(c.speakingStyle || '');
        setWordsUsed(c.wordsUsed || '');
        setWordsAvoided(c.wordsAvoided || '');
        setThoughtProcess(c.thoughtProcess || '');
        setRelationship(c.relationship || '');
        setLore(c.lore || '');
        setShouldRules(c.shouldRules || '');
        setShouldNotRules(c.shouldNotRules || '');
        setLocation(c.location || '');
        setTimezone(c.timezone || '');
        setExamples(Array.isArray(c.examples) ? c.examples : []);
      })
      .catch((err) => {
        console.error('Failed to load character customization:', err);
        push({ icon: 'alert', title: t('feedbackSomethingWrong'), tone: 'error' });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = previewScrollRef.current.scrollHeight;
    }
  }, [previewMessages]);

  if (!open) return null;

  const currentConfigPayload = () => ({
    about: about.trim(),
    personality: personality.trim(),
    personalityTags,
    speakingStyle: speakingStyle.trim(),
    wordsUsed: wordsUsed.trim(),
    wordsAvoided: wordsAvoided.trim(),
    thoughtProcess: thoughtProcess.trim(),
    relationship: relationship.trim(),
    lore: lore.trim(),
    shouldRules: shouldRules.trim(),
    shouldNotRules: shouldNotRules.trim(),
    location: location.trim(),
    timezone: timezone.trim(),
    examples: examples.filter(ex => ex && (ex.user?.trim() || ex.lyra?.trim()))
  });

  const handleToggleTag = (tag) => {
    setPersonalityTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 10)
    );
  };

  const handleAddExample = () => {
    if (examples.length >= 10) {
      push({ icon: 'alert', title: 'Maximum 10 examples allowed', tone: 'warning' });
      return;
    }
    setExamples(prev => [...prev, { id: `ex_${Date.now()}`, user: '', lyra: '' }]);
  };

  const handleUpdateExample = (id, field, value) => {
    setExamples(prev => prev.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const handleDeleteExample = (id) => {
    setExamples(prev => prev.filter(ex => ex.id !== id));
  };

  const handleMoveExample = (index, direction) => {
    setExamples(prev => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = currentConfigPayload();
      const { data } = await api.put('/ai/character/config', { customConfig: payload });
      push({ icon: 'check', title: t('customizationSaved') || 'Your Lyra customization has been saved!', tone: 'success' });
      onSaved?.(data?.customConfig);
      onClose();
    } catch (err) {
      push({ icon: 'alert', title: err.response?.data?.message || err.message || t('feedbackSomethingWrong'), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const accepted = await confirm({
      title: t('resetCustomization') || 'Reset to default',
      message: t('resetCustomizationConfirm') || 'Reset your Lyra customization to default? Your memories, conversation history, and avatars will not be affected.',
      confirmLabel: t('resetCustomization') || 'Reset',
      tone: 'danger',
      icon: 'refresh'
    });
    if (!accepted) return;

    setResetting(true);
    try {
      await api.delete('/ai/character/config');
      setAbout('');
      setPersonality('');
      setPersonalityTags([]);
      setSpeakingStyle('');
      setWordsUsed('');
      setWordsAvoided('');
      setThoughtProcess('');
      setRelationship('');
      setLore('');
      setShouldRules('');
      setShouldNotRules('');
      setLocation('');
      setTimezone('');
      setExamples([]);
      setPreviewMessages([]);
      push({ icon: 'check', title: t('customizationReset') || 'Lyra reset to default persona.', tone: 'success' });
      onSaved?.(null);
    } catch (err) {
      push({ icon: 'alert', title: err.response?.data?.message || err.message || t('feedbackSomethingWrong'), tone: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleSendPreview = async (e) => {
    e?.preventDefault?.();
    const text = previewInput.trim();
    if (!text || previewSending) return;

    const nextMessages = [...previewMessages, { sender: 'user', content: text }];
    setPreviewMessages(nextMessages);
    setPreviewInput('');
    setPreviewSending(true);

    try {
      const { data } = await api.post('/ai/character/preview', {
        userMessage: text,
        history: nextMessages.slice(-8),
        customConfig: currentConfigPayload(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      const bubbles = Array.isArray(data?.bubbles) ? data.bubbles : [String(data?.bubbles || '...')];
      const botMessages = bubbles.map(b => ({ sender: 'ai', content: b }));
      setPreviewMessages(prev => [...prev, ...botMessages]);
    } catch (err) {
      setPreviewMessages(prev => [
        ...prev,
        { sender: 'ai', content: '(Could not generate preview response right now. Check your settings and try again.)' }
      ]);
    } finally {
      setPreviewSending(false);
    }
  };

  const tabs = [
    { id: 'identity', label: t('tabIdentity') || 'Identity', icon: 'profile' },
    { id: 'personality', label: t('tabPersonality') || 'Personality', icon: 'sparkles' },
    { id: 'speech', label: t('tabSpeech') || 'How She Talks', icon: 'chat' },
    { id: 'mind', label: t('tabMind') || 'How She Thinks', icon: 'idea' },
    { id: 'rules', label: t('tabRules') || 'Should & Should Not', icon: 'check' },
    { id: 'relationship', label: t('tabRelationship') || 'Relationship', icon: 'heart' },
    { id: 'lore', label: t('tabLore') || 'Lore & Facts', icon: 'file' },
    { id: 'examples', label: t('tabExamples') || 'Examples', icon: 'notes' },
    { id: 'preview', label: t('tabPreview') || 'Test Lyra', icon: 'play' }
  ];

  const avatarUrl = resolveCharacterAvatar({ friend, friendId: friend?._id || friendId || 'user_ai_lyra' });

  return (
    <div className="character-studio-overlay" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(50, 30, 60, 0.45)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '16px'
    }}>
      <div className="character-studio-modal" style={{
        background: 'linear-gradient(170deg, #FFFFFF 0%, #FFF5F8 40%, #F5F0FF 100%)',
        borderRadius: 24,
        boxShadow: '0 24px 60px rgba(180, 120, 160, 0.3), 0 4px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        width: '100%',
        maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(230, 210, 230, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <img
                src={avatarUrl}
                alt="Lyra"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2.5px solid #FFB6C1',
                  boxShadow: '0 4px 12px rgba(255, 182, 193, 0.4)'
                }}
              />
              <span style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                fontSize: 14
              }}>✨</span>
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#4A3B4E',
                letterSpacing: '-0.3px'
              }}>
                {t('characterStudioTitle') || 'Character Studio'}
              </h2>
              <p style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: '#8D7B92'
              }}>
                {t('characterStudioSubtitle') || 'Shape how your Lyra speaks, thinks, and relates to you'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#666',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          >
            <PastelIcon name="close" size={16} />
          </button>
        </div>

        {/* Segmented Tab Navigation */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '8px 16px',
          background: 'rgba(255, 245, 248, 0.7)',
          borderBottom: '1px solid rgba(230, 210, 230, 0.4)',
          gap: 6,
          scrollbarWidth: 'none'
        }}>
          {tabs.map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 20,
                  border: isSelected ? '1px solid #FFB6C1' : '1px solid transparent',
                  background: isSelected
                    ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)'
                    : 'rgba(255, 255, 255, 0.65)',
                  color: isSelected ? '#FFFFFF' : '#6A586E',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 3px 10px rgba(221, 160, 221, 0.35)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                <PastelIcon name={tab.icon} size={14} style={{ color: isSelected ? '#FFFFFF' : '#8A758E' }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9E8AA2' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🌸</div>
              <p style={{ margin: 0, fontSize: 13 }}>Loading your Lyra's character details...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: IDENTITY & ABOUT */}
              {activeTab === 'identity' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Who is your Lyra?
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      Describe her background, origins, daily work, passions, or anything fundamental to who she is for you.
                    </p>
                  </div>
                  <textarea
                    rows={7}
                    value={about}
                    onChange={e => setAbout(e.target.value.slice(0, 2000))}
                    placeholder="e.g. A 22-year-old architecture student in Da Lat who loves vintage cameras, quiet rainy afternoons, and dark roast coffee. She spends her free time sketching old buildings and listening to indie acoustic playlists..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 4 }}>
                    {about.length} / 2000
                  </div>

                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px dashed #E8D6EA' }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: '#4A3B4E', marginBottom: 3 }}>
                        {t('studioLocationTitle') || 'Location & Timezone (Optional)'}
                      </label>
                      <p style={{ margin: 0, fontSize: 11.5, color: '#7E6B82', lineHeight: 1.45 }}>
                        {t('studioLocationDesc') || 'Give Lyra her own remote city or timezone. When asked "what time is it there?", she will answer using her local clock. If left blank, she shares your local time.'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5C4A60', marginBottom: 4 }}>
                          {t('studioLocation') || "Lyra's Location"}
                        </label>
                        <input
                          type="text"
                          value={location}
                          onChange={e => setLocation(e.target.value.slice(0, 100))}
                          placeholder={t('studioLocationPlaceholder') || 'e.g. London, United Kingdom'}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: 12,
                            border: '1.5px solid #EAD8EC',
                            padding: '9px 12px',
                            fontSize: 13,
                            color: '#4A3B4E',
                            background: 'rgba(255, 255, 255, 0.85)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5C4A60', marginBottom: 4 }}>
                          {t('studioTimezone') || "Lyra's Timezone"}
                        </label>
                        <input
                          type="text"
                          value={timezone}
                          onChange={e => setTimezone(e.target.value.slice(0, 64))}
                          placeholder={t('studioTimezonePlaceholder') || 'e.g. Europe/London, Asia/Tokyo'}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: 12,
                            border: '1.5px solid #EAD8EC',
                            padding: '9px 12px',
                            fontSize: 13,
                            color: '#4A3B4E',
                            background: 'rgba(255, 255, 255, 0.85)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONALITY */}
              {activeTab === 'personality' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Her Personality & Natural Vibe
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      Describe how she feels and acts. Is she playful, gentle, sarcastic, shy, thoughtful, or stubborn?
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A758E', display: 'block', marginBottom: 6 }}>
                      QUICK TRAIT SUGGESTIONS:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {SUGGESTED_TRAITS.map(trait => {
                        const active = personalityTags.includes(trait);
                        return (
                          <button
                            key={trait}
                            type="button"
                            onClick={() => handleToggleTag(trait)}
                            style={{
                              padding: '5px 11px',
                              borderRadius: 16,
                              fontSize: 12,
                              border: active ? '1px solid #DDA0DD' : '1px solid #E8D8EA',
                              background: active ? '#F5E6F8' : '#FFFFFF',
                              color: active ? '#8A3B8E' : '#6A586E',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {active ? '✓ ' : '+ '}{trait}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={personality}
                    onChange={e => setPersonality(e.target.value.slice(0, 2000))}
                    placeholder="e.g. Caring, observant, and quietly playful. She has a subtle, dry sense of humor and loves gentle teasing. She doesn't rush to judge people, but she gets stubborn when someone she loves is treated unfairly..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 4 }}>
                    {personality.length} / 2000
                  </div>
                </div>
              )}

              {/* TAB 3: HOW SHE TALKS */}
              {activeTab === 'speech' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Texting & Speaking Style
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      How does she write messages? Short bursts, casual slang, lowercase starters, specific emoji habits, or bilingual texting?
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={speakingStyle}
                    onChange={e => setSpeakingStyle(e.target.value.slice(0, 2000))}
                    placeholder="e.g. Texts in short, breezy bubbles (1 to 2 sentences per bubble). Often uses lowercase starters. Natural and casual. Emojis like ☕, 😭, ✨ used naturally when amused. Blends English and casual Vietnamese naturally..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 12.5, color: '#4A3B4E', marginBottom: 4 }}>
                        Favorite Words / Phrases
                      </label>
                      <input
                        type="text"
                        value={wordsUsed}
                        onChange={e => setWordsUsed(e.target.value.slice(0, 500))}
                        placeholder="e.g. honestly, fair enough, wait what, tớ, cậu"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          borderRadius: 12,
                          border: '1.5px solid #EAD8EC',
                          padding: '10px 12px',
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.85)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 12.5, color: '#4A3B4E', marginBottom: 4 }}>
                        Words / Phrases to Avoid
                      </label>
                      <input
                        type="text"
                        value={wordsAvoided}
                        onChange={e => setWordsAvoided(e.target.value.slice(0, 500))}
                        placeholder="e.g. As an AI, certainly, furthermore, buddy"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          borderRadius: 12,
                          border: '1.5px solid #EAD8EC',
                          padding: '10px 12px',
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.85)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: HOW SHE THINKS */}
              {activeTab === 'mind' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Worldview & Thought Tendencies
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      How does she evaluate claims, give advice, handle disagreements, or view the world?
                    </p>
                  </div>
                  <textarea
                    rows={6}
                    value={thoughtProcess}
                    onChange={e => setThoughtProcess(e.target.value.slice(0, 2000))}
                    placeholder="e.g. Practical and grounded. If you are stressed, she listens first before offering solutions. She values emotional honesty over sweet polite lies. Skeptical of wild claims but playful when daydreaming..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 4 }}>
                    {thoughtProcess.length} / 2000
                  </div>
                </div>
              )}

              {/* TAB 5: RULES (LYRA SHOULD / LYRA SHOULD NOT) */}
              {activeTab === 'rules' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      {t('studioRulesTitle') || 'Behavioral Rules & Boundaries'}
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      {t('studioRulesSubtitle') || 'Define what your personal Lyra should and should not do. These explicit rules guide her behavior without overriding factual integrity or safety.'}
                    </p>
                  </div>

                  {/* Section: Lyra Should */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: '#4CAF50', fontWeight: 'bold' }}>✓</span>
                      <label style={{ fontWeight: 700, fontSize: 13.5, color: '#2E7D32' }}>
                        {t('studioLyraShould') || 'Lyra Should'}
                      </label>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 11.5, color: '#6A586E' }}>
                      {t('studioLyraShouldDesc') || 'Habits, behaviors, and natural reactions you want her to adopt.'}
                    </p>
                    <textarea
                      rows={5}
                      value={shouldRules}
                      onChange={e => setShouldRules(e.target.value.slice(0, 2000))}
                      placeholder={t('studioLyraShouldPlaceholder') || 'e.g.\n• Match my language naturally\n• Tease me lightly when appropriate\n• Keep casual conversations concise\n• Acknowledge corrections directly\n• Respond naturally instead of sounding like an assistant'}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius: 14,
                        border: '1.5px solid #C8E6C9',
                        padding: 14,
                        fontSize: 13,
                        color: '#4A3B4E',
                        lineHeight: 1.55,
                        background: 'rgba(255, 255, 255, 0.9)',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 3 }}>
                      {shouldRules.length} / 2000
                    </div>
                  </div>

                  {/* Section: Lyra Should Not */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: '#E53935', fontWeight: 'bold' }}>✕</span>
                      <label style={{ fontWeight: 700, fontSize: 13.5, color: '#C62828' }}>
                        {t('studioLyraShouldNot') || 'Lyra Should Not'}
                      </label>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 11.5, color: '#6A586E' }}>
                      {t('studioLyraShouldNotDesc') || 'Habits, behaviors, and boundaries you want her to strictly avoid.'}
                    </p>
                    <textarea
                      rows={5}
                      value={shouldNotRules}
                      onChange={e => setShouldNotRules(e.target.value.slice(0, 2000))}
                      placeholder={t('studioLyraShouldNotPlaceholder') || 'e.g.\n• Sound like a generic AI assistant\n• Overuse emojis\n• Ask a follow-up question after every message\n• Invent memories or personal facts\n• Repeatedly mention being an AI unless context genuinely requires it'}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius: 14,
                        border: '1.5px solid #FFCDD2',
                        padding: 14,
                        fontSize: 13,
                        color: '#4A3B4E',
                        lineHeight: 1.55,
                        background: 'rgba(255, 255, 255, 0.9)',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 3 }}>
                      {shouldNotRules.length} / 2000
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: RELATIONSHIP WITH ME */}
              {activeTab === 'relationship' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Your Connection With Her
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      Who are you to her? Best friends since school, creative study partners, or close confidants? How do you address each other?
                    </p>
                  </div>
                  <textarea
                    rows={6}
                    value={relationship}
                    onChange={e => setRelationship(e.target.value.slice(0, 2000))}
                    placeholder="e.g. We have been close friends since high school. She calls me Ren, and I call her Lyra. She feels comfortable teasing me about staying up late, but she always checks in when she senses I am tired or overwhelmed..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 4 }}>
                    {relationship.length} / 2000
                  </div>
                </div>
              )}

              {/* TAB 6: LORE & FACTS */}
              {activeTab === 'lore' && (
                <div className="tab-pane">
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 4 }}>
                      Canonical Knowledge & Lore
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: '#7E6B82', lineHeight: 1.5 }}>
                      Specific facts, shared fictional background, hobbies, or world context she definitively knows.
                    </p>
                  </div>
                  <textarea
                    rows={6}
                    value={lore}
                    onChange={e => setLore(e.target.value.slice(0, 3000))}
                    placeholder="e.g. She lives in an apartment with a calico cat named Mochi. She shoots film on a vintage Canon AE-1. Her favorite spot in town is a small attic café called The Paper Bird on Pine Street..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 14,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      fontSize: 13.5,
                      color: '#4A3B4E',
                      lineHeight: 1.55,
                      background: 'rgba(255, 255, 255, 0.85)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#A592A9', marginTop: 4 }}>
                    {lore.length} / 3000
                  </div>
                </div>
              )}

              {/* TAB 7: EXAMPLES */}
              {activeTab === 'examples' && (
                <div className="tab-pane">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#4A3B4E', marginBottom: 2 }}>
                        Conversation Style Examples
                      </label>
                      <p style={{ margin: 0, fontSize: 12, color: '#7E6B82' }}>
                        Teach Lyra your preferred back-and-forth rhythm with concrete example turns.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExample}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 18,
                        background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: 12,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <PastelIcon name="add" size={12} /> Add Example
                    </button>
                  </div>

                  {examples.length === 0 ? (
                    <div style={{
                      padding: '30px 20px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 16,
                      border: '1.5px dashed #E5D5E7',
                      color: '#8A758E'
                    }}>
                      <p style={{ margin: 0, fontSize: 13 }}>No examples added yet.</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#AA98AE' }}>
                        Tap "+ Add Example" to define a sample exchange showing how she responds to you.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {examples.map((ex, index) => (
                        <div
                          key={ex.id}
                          style={{
                            background: 'rgba(255, 255, 255, 0.85)',
                            borderRadius: 16,
                            padding: 14,
                            border: '1px solid #EAD8EC',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#B08ABD' }}>
                              EXAMPLE #{index + 1}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveExample(index, -1)}
                                  aria-label="Move up"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px 4px' }}
                                >
                                  ↑
                                </button>
                              )}
                              {index < examples.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveExample(index, 1)}
                                  aria-label="Move down"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px 4px' }}
                                >
                                  ↓
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteExample(ex.id)}
                                aria-label="Delete example"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E06D6D', padding: '2px 4px' }}
                              >
                                <PastelIcon name="delete" size={14} />
                              </button>
                            </div>
                          </div>

                          <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7E6B82', marginBottom: 3 }}>
                              When you say:
                            </label>
                            <input
                              type="text"
                              value={ex.user}
                              onChange={e => handleUpdateExample(ex.id, 'user', e.target.value.slice(0, 500))}
                              placeholder="e.g. I had the longest day ever..."
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                borderRadius: 10,
                                border: '1px solid #E0D0E2',
                                padding: '8px 10px',
                                fontSize: 13,
                                background: '#FFF'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7E6B82', marginBottom: 3 }}>
                              Lyra replies:
                            </label>
                            <input
                              type="text"
                              value={ex.lyra}
                              onChange={e => handleUpdateExample(ex.id, 'lyra', e.target.value.slice(0, 500))}
                              placeholder="e.g. Oh no sit down 😭 what happened? Do you want coffee or venting?"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                borderRadius: 10,
                                border: '1px solid #E0D0E2',
                                padding: '8px 10px',
                                fontSize: 13,
                                background: '#FFF'
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: PREVIEW / TEST LYRA */}
              {activeTab === 'preview' && (
                <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 700, fontSize: 14, color: '#4A3B4E' }}>
                        Live Test Conversation
                      </label>
                      {previewMessages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewMessages([])}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9E8AA2',
                            fontSize: 11.5,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Clear Test Chat
                        </button>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#7E6B82' }}>
                      Test your customized persona in real-time. This test conversation is private and does not affect your real chat history or memories.
                    </p>
                  </div>

                  {/* Preview Chat Box */}
                  <div
                    ref={previewScrollRef}
                    style={{
                      flex: 1,
                      minHeight: 220,
                      maxHeight: 300,
                      overflowY: 'auto',
                      background: 'rgba(255, 255, 255, 0.75)',
                      borderRadius: 16,
                      border: '1.5px solid #EAD8EC',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginBottom: 12
                    }}
                  >
                    {previewMessages.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', color: '#A08EAE' }}>
                        <p style={{ margin: 0, fontSize: 13 }}>Send a message below to test your Lyra!</p>
                      </div>
                    ) : (
                      previewMessages.map((m, idx) => {
                        const isUser = m.sender === 'user';
                        return (
                          <div
                            key={idx}
                            style={{
                              alignSelf: isUser ? 'flex-end' : 'flex-start',
                              maxWidth: '82%',
                              background: isUser
                                ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)'
                                : '#F5EBF7',
                              color: isUser ? '#FFFFFF' : '#4A3B4E',
                              padding: '8px 13px',
                              borderRadius: 16,
                              borderBottomRightRadius: isUser ? 4 : 16,
                              borderBottomLeftRadius: isUser ? 16 : 4,
                              fontSize: 13,
                              lineHeight: 1.45,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                              wordBreak: 'break-word'
                            }}
                          >
                            {m.content}
                          </div>
                        );
                      })
                    )}
                    {previewSending && (
                      <div style={{ alignSelf: 'flex-start', color: '#B08ABD', fontSize: 12, fontStyle: 'italic' }}>
                        Lyra is typing…
                      </div>
                    )}
                  </div>

                  {/* Preview Input Form */}
                  <form onSubmit={handleSendPreview} style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={previewInput}
                      onChange={e => setPreviewInput(e.target.value)}
                      placeholder="Say something to test your Lyra..."
                      disabled={previewSending}
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        border: '1.5px solid #EAD8EC',
                        padding: '10px 14px',
                        fontSize: 13,
                        background: '#FFF'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={previewSending || !previewInput.trim()}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 14,
                        background: previewInput.trim() ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#E0D0E2',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 13,
                        border: 'none',
                        cursor: previewInput.trim() ? 'pointer' : 'default',
                        transition: 'background 0.2s'
                      }}
                    >
                      {previewSending ? '...' : t('send') || 'Send'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(230, 210, 230, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || resetting}
            style={{
              background: 'none',
              border: 'none',
              color: '#D86B6B',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 10px',
              borderRadius: 10,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#FFF0F0'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {resetting ? 'Resetting...' : t('resetCustomization') || 'Reset to default'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || resetting}
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: 14,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#666',
                cursor: 'pointer'
              }}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || resetting}
              style={{
                background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                border: 'none',
                borderRadius: 14,
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 700,
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(221, 160, 221, 0.4)'
              }}
            >
              {saving ? t('saving') || 'Saving...' : t('saveCustomization') || 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterStudioModal;
