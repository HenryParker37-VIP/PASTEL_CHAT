// AvatarImg.js — Drop-in <img> replacement that handles chr: SVG avatars
import React from 'react';
import { generateAvatarSVG } from './AvatarRenderer';
import { parseCharacterUrl } from '../data/avatars';

const AvatarImg = ({ src, alt, style, className, width, height, onClick, ...rest }) => {
  if (src && src.startsWith('chr:')) {
    const opts = parseCharacterUrl(src);
    const svgString = generateAvatarSVG(opts || {});
    const divStyle = {
      display: 'inline-block',
      overflow: 'hidden',
      flexShrink: style?.flexShrink,
      width: width || style?.width || 40,
      height: height || style?.height || 40,
      borderRadius: style?.borderRadius || '50%',
      objectFit: style?.objectFit,
      border: style?.border,
      boxShadow: style?.boxShadow,
      cursor: onClick ? 'pointer' : style?.cursor,
      verticalAlign: 'middle',
      ...style,
    };
    return (
      <div
        className={className}
        style={divStyle}
        onClick={onClick}
        title={alt}
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className={className}
      width={width}
      height={height}
      onClick={onClick}
      {...rest}
    />
  );
};

export default AvatarImg;
