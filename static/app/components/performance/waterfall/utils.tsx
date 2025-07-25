import {css, type Theme} from '@emotion/react';
import Color from 'color';

import type {DurationDisplay} from 'sentry/components/performance/waterfall/types';
import {space} from 'sentry/styles/space';

import type {SpanBarType} from './constants';
import {getSpanBarColors} from './constants';

export const getBackgroundColor = ({
  showStriping,
  showDetail,
  theme,
}: {
  theme: Theme;
  showDetail?: boolean;
  showStriping?: boolean;
}) => {
  if (showDetail) {
    return theme.textColor;
  }

  if (showStriping) {
    return theme.backgroundSecondary;
  }

  return theme.background;
};

export function getHatchPattern(spanBarType: SpanBarType | undefined, theme: Theme) {
  if (spanBarType) {
    const {primary, alternate} = getSpanBarColors(spanBarType, theme);

    return css`
      background-image: linear-gradient(
        135deg,
        ${alternate},
        ${alternate} 2.5px,
        ${primary} 2.5px,
        ${primary} 5px,
        ${alternate} 6px,
        ${alternate} 8px,
        ${primary} 8px,
        ${primary} 11px,
        ${alternate} 11px,
        ${alternate} 14px,
        ${primary} 14px,
        ${primary} 16.5px,
        ${alternate} 16.5px,
        ${alternate} 19px,
        ${primary} 20px
      );
      background-size: 16px 16px;
    `;
  }

  return null;
}

export const getDurationPillAlignment = ({
  durationDisplay,
}: {
  durationDisplay: DurationDisplay;
  theme: Theme;
  spanBarType?: SpanBarType;
}) => {
  switch (durationDisplay) {
    case 'left':
      return css`
        right: calc(100% + ${space(0.5)});
      `;
    case 'right':
      return css`
        left: calc(100% + ${space(0.75)});
      `;
    default:
      return css`
        right: ${space(0.75)};
      `;
  }
};

export const getDurationPillColors = ({
  durationDisplay,
  theme,
  showDetail,
  spanBarType,
}: {
  durationDisplay: DurationDisplay;
  showDetail: boolean;
  theme: Theme;
  spanBarType?: SpanBarType;
}) => {
  if (durationDisplay === 'inset') {
    const {alternate, insetTextColor} = getSpanBarColors(spanBarType, theme);
    return `background: ${alternate}; color: ${insetTextColor};`;
  }

  return `color: ${showDetail ? theme.gray200 : theme.gray300};`;
};

export const getToggleTheme = ({
  theme,
  isExpanded,
  disabled,
  errored,
  isSpanGroupToggler,
  spanBarType,
}: {
  disabled: boolean;
  errored: boolean;
  isExpanded: boolean;
  theme: Theme;
  isSpanGroupToggler?: boolean;
  spanBarType?: SpanBarType;
}) => {
  if (spanBarType) {
    const {primary} = getSpanBarColors(spanBarType, theme);
    return css`
      background: ${primary};
      border: 2px solid ${theme.button.default.border};
      color: ${theme.button.primary.color};
      cursor: pointer;
    `;
  }

  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;
  const errorTheme = theme.button.danger;

  const background = errored
    ? isExpanded
      ? buttonTheme.background
      : errorTheme.background
    : buttonTheme.background;
  const border = errored ? errorTheme.background : buttonTheme.border;
  const color = errored
    ? isExpanded
      ? errorTheme.background
      : buttonTheme.color
    : buttonTheme.color;

  if (isSpanGroupToggler) {
    return css`
      background: ${theme.blue300};
      border: 2px solid ${theme.button.default.border};
      color: ${color};
      cursor: pointer;
    `;
  }

  if (disabled) {
    return css`
      background: ${background};
      border: 2px solid ${border};
      color: ${color};
      cursor: default;
    `;
  }

  return css`
    background: ${background};
    border: 2px solid ${border};
    color: ${color};
  `;
};

export const getDurationDisplay = ({
  width,
  left,
}: {
  left: undefined | number;
  width: undefined | number;
}): DurationDisplay => {
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }
  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }
  if (left > spaceNeeded) {
    return 'left';
  }
  return 'inset';
};

export const getHumanDuration = (duration: number): string => {
  // note: duration is assumed to be in seconds
  const durationMs = duration * 1000;
  return `${durationMs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}ms`;
};

type Rect = {
  height: number;
  width: number;
  // x and y are left/top coords respectively
  x: number;
  y: number;
};

// get position of element relative to top/left of document
export const getOffsetOfElement = (element: Element) => {
  // left and top are relative to viewport
  const {left, top} = element.getBoundingClientRect();

  // get values that the document is currently scrolled by
  const scrollLeft = window.pageXOffset;
  const scrollTop = window.pageYOffset;

  return {x: left + scrollLeft, y: top + scrollTop};
};

export const rectOfContent = (element: Element): Rect => {
  const {x, y} = getOffsetOfElement(element);

  // offsets for the border and any scrollbars (clientLeft and clientTop),
  // and if the element was scrolled (scrollLeft and scrollTop)
  //
  // NOTE: clientLeft and clientTop does not account for any margins nor padding
  const contentOffsetLeft = element.clientLeft - element.scrollLeft;
  const contentOffsetTop = element.clientTop - element.scrollTop;

  return {
    x: x + contentOffsetLeft,
    y: y + contentOffsetTop,
    width: element.scrollWidth,
    height: element.scrollHeight,
  };
};

const getLetterIndex = (letter: string): number => {
  const index = 'abcdefghijklmnopqrstuvwxyz'.indexOf(letter) || 0;
  return index === -1 ? 0 : index;
};

export const makeBarColors = (theme: Theme) => ({
  default: theme.chart.colors[17][4],
  transaction: theme.chart.colors[17][8],
  http: theme.chart.colors[17][10],
  db: theme.chart.colors[17][17],
});

export const pickBarColor = (input: string | undefined, theme: Theme): string => {
  // We pick the color for span bars using the first three letters of the op name.
  // That way colors stay consistent between transactions.
  const barColors = makeBarColors(theme);

  if (!input || input.length < 3) {
    const colors = theme.chart.getColorPalette(17);
    return colors[4];
  }

  if (input in barColors) {
    return barColors[input as keyof typeof barColors];
  }

  const colorsAsArray = Object.values(theme.chart.colors[17]);

  const letterIndex1 = getLetterIndex(input[0]!);
  const letterIndex2 = getLetterIndex(input[1]!);
  const letterIndex3 = getLetterIndex(input[2]!);
  const letterIndex4 = getLetterIndex(input[3]!);

  return colorsAsArray[
    (letterIndex1 + letterIndex2 + letterIndex3 + letterIndex4) % colorsAsArray.length
  ]!;
};

export const lightenBarColor = (
  input: string | undefined,
  lightenRatio: number,
  theme: Theme
): string => {
  const barColor = pickBarColor(input, theme);
  return Color(barColor).lighten(lightenRatio).string();
};
