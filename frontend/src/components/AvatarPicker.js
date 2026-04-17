import React from 'react';
import AVATARS from '../data/avatars';

const AvatarPicker = ({ selected, onSelect }) => (
  <div className="avatar-grid">
    {AVATARS.map((a) => (
      <button
        type="button"
        key={a.id}
        className={`avatar-option ${selected === a.seed ? 'selected' : ''}`}
        onClick={() => onSelect(a.seed)}
        title={a.seed}
      >
        <img src={a.url} alt={a.seed} loading="lazy" />
      </button>
    ))}
  </div>
);

export default AvatarPicker;
