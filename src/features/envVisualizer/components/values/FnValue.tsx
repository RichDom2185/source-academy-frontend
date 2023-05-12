import { Environment } from 'js-slang/dist/types';
import { KonvaEventObject } from 'konva/lib/Node';
import React, { RefObject } from 'react';
import {
  Circle,
  Group,
  Label as KonvaLabel,
  Tag as KonvaTag,
  Text as KonvaText
} from 'react-konva';
import { ArrowFromFn } from 'src/features/envVisualizer/components/arrows/ArrowFromFn';
import { GenericArrow } from 'src/features/envVisualizer/components/arrows/GenericArrow';
import { Binding } from 'src/features/envVisualizer/components/Binding';
import { Frame } from 'src/features/envVisualizer/components/Frame';
import EnvVisualizer from 'src/features/envVisualizer/EnvVisualizer';
import { Config, ShapeDefaultProps } from 'src/features/envVisualizer/EnvVisualizerConfig';
import { Layout } from 'src/features/envVisualizer/EnvVisualizerLayout';
import {
  EnvTreeNode,
  FnTypes,
  IHoverable,
  ReferenceType
} from 'src/features/envVisualizer/EnvVisualizerTypes';
import {
  getBodyText,
  getNonEmptyEnv,
  getParamsText,
  getTextWidth,
  setHoveredStyle,
  setUnhoveredStyle
} from 'src/features/envVisualizer/EnvVisualizerUtils';

import { GlobalFnValue } from './GlobalFnValue';
import { Value } from './Value';

/** this class encapsulates a JS Slang function (not from the global frame) that
 *  contains extra props such as environment and fnName */
export class FnValue extends Value implements IHoverable {
  centerX: number;
  readonly tooltipWidth: number;
  readonly exportTooltipWidth: number;
  readonly radius: number = Config.FnRadius;
  readonly innerRadius: number = Config.FnInnerRadius;

  /** name of this function */
  readonly fnName: string;
  readonly paramsText: string;
  readonly bodyText: string;
  readonly exportBodyText: string;
  readonly tooltip: string;
  readonly exportTooltip: string;
  private selected: boolean = false;
  private _arrow: GenericArrow<FnValue | GlobalFnValue, Frame> | undefined;

  /** the parent/enclosing environment of this fn value */
  readonly enclosingEnvNode: EnvTreeNode;
  readonly ref: RefObject<any> = React.createRef();
  readonly labelRef: RefObject<any> = React.createRef();

  constructor(
    /** underlying JS Slang function (contains extra props) */
    readonly data: FnTypes,
    /** what this value is being referenced by */
    readonly referencedBy: ReferenceType[]
  ) {
    super();
    Layout.memoizeValue(this);

    // derive the coordinates from the main reference (binding / array unit)
    const mainReference = this.referencedBy[0];
    if (mainReference instanceof Binding) {
      this._x = mainReference.frame.x() + mainReference.frame.width() + Config.FrameMarginX / 4;
      this._y = mainReference.y();
      this.centerX = this._x + this.radius * 2;
    } else {
      if (mainReference.isLastUnit) {
        this._x = mainReference.x() + Config.DataUnitWidth * 2;
        this._y = mainReference.y() + Config.DataUnitHeight / 2 - this.radius;
      } else {
        this._x = mainReference.x();
        this._y = mainReference.y() + mainReference.parent.height() + Config.DataUnitHeight;
      }
      this.centerX = this._x + Config.DataUnitWidth / 2;
      this._x = this.centerX - this.radius * 2;
    }
    this._y += this.radius;

    this._width = this.radius * 4;
    this._height = this.radius * 2;

    this.enclosingEnvNode = Layout.environmentTree.getTreeNode(
      getNonEmptyEnv(this.data.environment) as Environment
    ) as EnvTreeNode;
    this.fnName = this.data.functionName;

    this.paramsText = `params: (${getParamsText(this.data)})`;
    this.bodyText = `body: ${getBodyText(this.data)}`;
    this.exportBodyText =
      (this.bodyText.length > 23 ? this.bodyText.slice(0, 20) : this.bodyText)
        .split('\n')
        .slice(0, 2)
        .join('\n') + ' ...';
    this.tooltip = `${this.paramsText}\n${this.bodyText}`;
    this.exportTooltip = `${this.paramsText}\n${this.exportBodyText}`;
    this.tooltipWidth = Math.max(getTextWidth(this.paramsText), getTextWidth(this.bodyText));
    this.exportTooltipWidth = Math.max(
      getTextWidth(this.paramsText),
      getTextWidth(this.exportBodyText)
    );
  }

  isSelected(): boolean {
    return this.selected;
  }
  arrow(): GenericArrow<FnValue | GlobalFnValue, Frame> | undefined {
    return this._arrow;
  }
  updatePosition(): void {
    const mainReference =
      this.referencedBy.find(
        x => x instanceof Binding && (x as Binding).frame.envTreeNode === this.enclosingEnvNode
      ) || this.referencedBy[0];
    if (mainReference instanceof Binding) {
      this._x = mainReference.frame.x() + mainReference.frame.width() + Config.FrameMarginX / 4;
      this._y = mainReference.y();
      this.centerX = this._x + this.radius * 2;
    } else {
      if (mainReference.isLastUnit) {
        this._x = mainReference.x() + Config.DataUnitWidth * 2;
        this._y = mainReference.y() + Config.DataUnitHeight / 2 - this.radius;
      } else {
        this._x = mainReference.x();
        this._y = mainReference.y() + mainReference.parent.height() + Config.DataUnitHeight;
      }
      this.centerX = this._x + Config.DataUnitWidth / 2;
      this._x = this.centerX - this.radius * 2;
    }
    this._y += this.radius;
  }
  reset(): void {
    super.reset();
    this.referencedBy.length = 0;
  }
  onMouseEnter = ({ currentTarget }: KonvaEventObject<MouseEvent>) => {
    if (EnvVisualizer.getPrintableMode()) return;
    this.labelRef.current.moveToTop();
    this.labelRef.current.show();
    setHoveredStyle(currentTarget);
  };

  onMouseLeave = ({ currentTarget }: KonvaEventObject<MouseEvent>) => {
    if (EnvVisualizer.getPrintableMode()) return;
    if (!this.selected) {
      this.labelRef.current.hide();
      setUnhoveredStyle(currentTarget);
    } else {
      const container = currentTarget.getStage()?.container();
      container && (container.style.cursor = 'default');
    }
  };
  onClick = ({ currentTarget }: KonvaEventObject<MouseEvent>) => {
    if (EnvVisualizer.getPrintableMode()) return;
    this.selected = !this.selected;
    if (!this.selected) {
      this.labelRef.current.hide();
      setUnhoveredStyle(currentTarget);
    } else {
      this.labelRef.current.show();
      setHoveredStyle(currentTarget);
    }
  };

  draw(): React.ReactNode {
    this._isDrawn = true;
    this._arrow =
      this.enclosingEnvNode.frame && new ArrowFromFn(this).to(this.enclosingEnvNode.frame);
    return (
      <React.Fragment key={Layout.key++}>
        <Group
          onMouseEnter={e => this.onMouseEnter(e)}
          onMouseLeave={e => this.onMouseLeave(e)}
          onClick={e => this.onClick(e)}
          ref={this.ref}
        >
          <Circle
            {...ShapeDefaultProps}
            key={Layout.key++}
            x={this.centerX - this.radius}
            y={this.y()}
            radius={this.radius}
            stroke={
              EnvVisualizer.getPrintableMode()
                ? Config.SA_BLUE.toString()
                : Config.SA_WHITE.toString()
            }
          />
          <Circle
            {...ShapeDefaultProps}
            key={Layout.key++}
            x={this.centerX - this.radius}
            y={this.y()}
            radius={this.innerRadius}
            fill={
              EnvVisualizer.getPrintableMode()
                ? Config.SA_BLUE.toString()
                : Config.SA_WHITE.toString()
            }
          />
          <Circle
            {...ShapeDefaultProps}
            key={Layout.key++}
            x={this.centerX + this.radius}
            y={this.y()}
            radius={this.radius}
            stroke={
              EnvVisualizer.getPrintableMode()
                ? Config.SA_BLUE.toString()
                : Config.SA_WHITE.toString()
            }
          />
          <Circle
            {...ShapeDefaultProps}
            key={Layout.key++}
            x={this.centerX + this.radius}
            y={this.y()}
            radius={this.innerRadius}
            fill={
              EnvVisualizer.getPrintableMode()
                ? Config.SA_BLUE.toString()
                : Config.SA_WHITE.toString()
            }
          />
        </Group>
        {EnvVisualizer.getPrintableMode() ? (
          <KonvaLabel
            x={this.x() + this.width() + Config.TextPaddingX * 2}
            y={this.y() - Config.TextPaddingY}
            visible={true}
            ref={this.labelRef}
          >
            <KonvaTag stroke="black" fill={'white'} opacity={Number(Config.FnTooltipOpacity)} />
            <KonvaText
              text={this.exportTooltip}
              fontFamily={Config.FontFamily.toString()}
              fontSize={Number(Config.FontSize)}
              fontStyle={Config.FontStyle.toString()}
              fill={Config.SA_BLUE.toString()}
              padding={5}
            />
          </KonvaLabel>
        ) : (
          <KonvaLabel
            x={this.x() + this.width() + Config.TextPaddingX * 2}
            y={this.y() - Config.TextPaddingY}
            visible={false}
            ref={this.labelRef}
          >
            <KonvaTag stroke="black" fill={'black'} opacity={Number(Config.FnTooltipOpacity)} />
            <KonvaText
              text={this.tooltip}
              fontFamily={Config.FontFamily.toString()}
              fontSize={Number(Config.FontSize)}
              fontStyle={Config.FontStyle.toString()}
              fill={Config.SA_WHITE.toString()}
              padding={5}
            />
          </KonvaLabel>
        )}
        {this._arrow?.draw()}
      </React.Fragment>
    );
  }
}
