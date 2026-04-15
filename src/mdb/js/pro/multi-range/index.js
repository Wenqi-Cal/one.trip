import { typeCheckConfig } from '../../mdb/util/index';
import EventHandler, { EventHandlerMulti } from '../../mdb/dom/event-handler';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import Data from '../../mdb/dom/data';
import { getConnectsTemplate, getHandleTemplate, getTooltipTemplate } from './template';
import { getEventTypeClientX } from './utils';
import BaseComponent from '../../free/base-component';
import { bindCallbackEventsIfNeeded } from '../../autoinit/init';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'multiRangeSlider';
const DATA_KEY = `mdb.${NAME}`;
const SELECTOR_MULTI = 'multi-range-slider';

const EVENT_KEY = `.${DATA_KEY}`;
const EVENT_VALUE_CHANGED = `valueChanged${EVENT_KEY}`;
const EVENT_START = `start${EVENT_KEY}`;
const EVENT_END = `end${EVENT_KEY}`;

const CLASSNAME_HAND = '.multi-range-slider-hand';
const CLASSNAME_CONNECT = '.multi-range-slider-connect';
const CLASSNAME_TOOLTIP = '.multi-range-slider-tooltip';
const CLASSNAME_TOOLTIP_VALUE = '.multi-range-slider-tooltip-value';

const SELECTOR_ACTIVE = 'active';
const SELECTOR_HORIZONTAL = 'multi-range-slider-horizontal';

const DefaultType = {
  max: 'number',
  min: 'number',
  numberOfRanges: 'number',
  startValues: 'array',
  step: '(string||null||number)',
  tooltip: 'boolean',
};

const Default = {
  max: 100,
  min: 0,
  numberOfRanges: 2,
  startValues: [0, 100],
  step: null,
  tooltip: false,
};

class MultiRangeSlider extends BaseComponent {
  constructor(element, data = {}) {
    super(element);
    this._options = this._getConfig(data);
    this._mousemove = false;
    this._movingHand = null;

    this.init();
    Manipulator.setDataAttribute(this._element, `${this.constructor.NAME}-initialized`, true);
    bindCallbackEventsIfNeeded(this.constructor);
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get hands() {
    return SelectorEngine.find(CLASSNAME_HAND, this._element);
  }

  get connect() {
    return SelectorEngine.findOne(CLASSNAME_CONNECT, this._element);
  }

  get leftConnectRect() {
    return this.connect.getBoundingClientRect().left;
  }

  get handsNoActive() {
    return this.hands.filter((hand) => !Manipulator.hasClass(hand, 'active'));
  }

  get handActive() {
    return SelectorEngine.findOne(`${CLASSNAME_HAND}.active`, this._element);
  }

  get activeTooltip() {
    return SelectorEngine.findOne(CLASSNAME_TOOLTIP, this._element);
  }

  get activeTooltipValue() {
    const handTooltip = SelectorEngine.findOne(`${CLASSNAME_HAND}.active`, this._element);
    return SelectorEngine.findOne(`${CLASSNAME_TOOLTIP_VALUE}`, handTooltip);
  }

  // Public

  init() {
    this._setClassHorizontalOrVertical();
    this._setRangeConnectsElement();
    this._setRangeHandleElements();
    this._setTransformationOnStart();
    this._setTooltipToHand();
    this._addEventListeners();
  }

  dispose() {
    Manipulator.removeDataAttribute(this._element, `${this.constructor.NAME}-initialized`);

    Manipulator.removeClass(this._element, SELECTOR_HORIZONTAL);

    this._removeEventListeners();

    this._removeSliderElements();

    super.dispose();
  }

  // Private
  _removeSliderElements() {
    this.hands.forEach((hand) => {
      hand.remove();
    });

    this.connect.parentNode.remove();
  }

  _addEventListeners() {
    this._onWindowResize = this._handleWindowResize.bind(this);

    this._onConnectMousedown = this._handleClickOnRange.bind(this);
    this._onHandMouseDown = this._handleClickEventOnHand.bind(this);
    this._onDocumentMouseUp = this._handleEndMoveEventDocument.bind(this);

    EventHandlerMulti.on(this.connect, 'mousedown touchstart', this._onConnectMousedown);
    EventHandlerMulti.on(document, 'mouseup touchend', this._onDocumentMouseUp);
    this.hands.forEach((hand) => {
      EventHandlerMulti.on(hand, 'mousedown touchstart', this._onHandMouseDown);
    });

    EventHandler.on(window, 'resize', this._onWindowResize);
  }

  _removeEventListeners() {
    EventHandlerMulti.off(this.connect, 'mousedown touchstart', this._onConnectMousedown);
    EventHandlerMulti.off(document, 'mouseup touchend', this._onDocumentMouseUp);
    this.hands.forEach((hand) => {
      EventHandlerMulti.off(hand, 'mousedown touchstart', this._onHandMouseDown);
    });
    EventHandler.off(window, 'resize', this._onWindowResize);
  }

  _handleWindowResize() {
    this._setTransformationOnStart();
  }

  _setTransformationOnStart() {
    const { startValues, max, min } = this._options;

    if (startValues.length === 0) {
      this.hands.forEach((hand) => {
        const translation = -hand.offsetWidth;

        Manipulator.setDataAttribute(hand, 'translation', Math.round(translation));

        Manipulator.addStyle(hand, {
          transform: `translate(${translation}px,-25%)`,
        });
      });
    } else {
      this.hands.forEach((hand, i) => {
        if (startValues[i] > max || startValues[i] < min) return;
        const normalizedValue = (startValues[i] - min) / (max - min);
        const translation = normalizedValue * this.connect.offsetWidth - hand.offsetWidth / 2;

        Manipulator.setDataAttribute(hand, 'translation', Math.round(translation));

        Manipulator.addStyle(hand, {
          transform: `translate(${translation}px,-25%)`,
        });
      });
    }
  }

  _handleClickEventOnHand(ev) {
    const hand = ev.target.closest(CLASSNAME_HAND);
    this._disableTextSelection();

    const { max, min } = this._options;

    this._mousemove = true;
    const translation = getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2;

    const value =
      ((getEventTypeClientX(ev) - this.leftConnectRect) /
        (this.connect.offsetWidth / (max - min))) %
      (max - min);

    Manipulator.addStyle(hand, {
      transform: `translate(${translation}px,-25%)`,
    });

    Manipulator.setDataAttribute(hand, 'translation', translation);

    // Bring clicked hand to front
    this.hands.forEach((h) => {
      Manipulator.addStyle(h, { zIndex: h === hand ? '10' : '1' });
    });

    Manipulator.addClass(hand, SELECTOR_ACTIVE);

    if (this._options.tooltip) {
      Manipulator.addClass(hand.children[1], 'active');
      this.activeTooltipValue.innerText = Math.round(value);
    }

    this._movingHand = hand;

    if (!this._onDocumentMouseMove) {
      this._onDocumentMouseMove = this._handleMouseMoveEventDocument.bind(this);
    }
    if (!this._onHandMouseUp) {
      this._onHandMouseUp = this._handleEndMoveEvent.bind(this);
    }

    EventHandlerMulti.on(document, 'mousemove touchmove', this._onDocumentMouseMove);
    EventHandlerMulti.on(hand, 'mouseup touchend', this._onHandMouseUp);

    EventHandler.trigger(hand, EVENT_START, { hand });
  }

  _setClassHorizontalOrVertical() {
    if (this._element) {
      Manipulator.addClass(this._element, SELECTOR_MULTI);
    }

    Manipulator.addClass(this._element, SELECTOR_HORIZONTAL);
  }

  _setRangeConnectsElement() {
    this._element.insertAdjacentHTML('afterbegin', getConnectsTemplate());
  }

  _setRangeHandleElements() {
    for (let i = 0; i < this._options.numberOfRanges; i++) {
      this._element.insertAdjacentHTML('beforeend', getHandleTemplate());
    }

    this.hands.forEach((hand, i) => {
      hand.setAttribute('aria-orientation', 'horizontal');
      hand.setAttribute('role', 'slider');

      Manipulator.setDataAttribute(hand, 'handle', i);
    });
  }

  _setTooltipToHand() {
    if (this._options.tooltip) {
      this.hands.forEach((hand) => {
        return hand.insertAdjacentHTML('beforeend', getTooltipTemplate());
      });
    }
  }

  _handleMouseMoveEventDocument(ev) {
    const { tooltip, step } = this._options;

    const hand = this._movingHand;

    if (ev.type === 'mousemove') ev.preventDefault();

    const { max, min, numberOfRanges } = this._options;

    if (Manipulator.hasClass(hand, SELECTOR_ACTIVE)) {
      const maxValue =
        ((getEventTypeClientX(ev) - this.leftConnectRect) / this.connect.offsetWidth) * max;
      let value =
        (((getEventTypeClientX(ev) - this.leftConnectRect) /
          (this.connect.offsetWidth / (max - min))) %
          (max - min)) +
        min;

      let translation = getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2;

      if (value < min) {
        translation = min - hand.offsetWidth / 2;
        value = min;
      } else if (maxValue >= max) {
        return;
      }

      if (step !== null) {
        const snappedValue = Math.round(value / step) * step;
        const normalizedSnappedValue = (snappedValue - min) / (max - min);

        translation = normalizedSnappedValue * this.connect.offsetWidth - hand.offsetWidth / 2;
        value = snappedValue;
      }

      let canMove = true;

      if (numberOfRanges >= 2) {
        for (const otherHand of this.handsNoActive) {
          const otherTranslation = parseFloat(
            Manipulator.getDataAttribute(otherHand, 'translation')
          );
          const otherHandle = parseInt(Manipulator.getDataAttribute(otherHand, 'handle'), 10);
          const currentHandle = parseInt(Manipulator.getDataAttribute(hand, 'handle'), 10);

          // Hands with lower handle numbers should stay to the left
          if (currentHandle < otherHandle && translation > otherTranslation) {
            canMove = false;
            break;
          }

          // Hands with higher handle numbers should stay to the right
          if (currentHandle > otherHandle && translation < otherTranslation) {
            canMove = false;
            break;
          }
        }
      }

      if (canMove) {
        if (Math.round(value) % step === 0 && step !== null) {
          Manipulator.addStyle(hand, {
            transform: `translate(${translation}px,-25%)`,
          });

          if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
        } else if (step === null) {
          Manipulator.addStyle(hand, {
            transform: `translate(${translation}px,-25%)`,
          });

          if (tooltip) this.activeTooltipValue.innerText = Math.round(value);
        }

        Manipulator.setDataAttribute(hand, 'translation', translation);
      }

      if (numberOfRanges < 2) {
        EventHandler.trigger(this._element, EVENT_VALUE_CHANGED, {
          values: { value: value + min, rounded: Math.round(value + min) },
        });
      } else {
        this._handleMultiValuesOnRange();
      }
    }
  }

  _handleMultiValuesOnRange() {
    const { max, min } = this._options;
    const arr = [];

    this.hands.forEach((hand) => {
      const translation =
        hand.getBoundingClientRect().left - this.leftConnectRect + hand.offsetWidth / 2;

      let value = (translation / (this.connect.offsetWidth / (max - min))) % (max - min);

      if (translation === this.connect.offsetWidth) {
        value = max;
      } else {
        value += min;
      }

      Manipulator.setDataAttribute(hand, 'value', Math.round(value * 10) / 10);

      arr.push({ value });
    });

    EventHandler.trigger(this._element, EVENT_VALUE_CHANGED, {
      values: {
        value: arr.map(({ value }) => value),
        rounded: arr.map(({ value }) => Math.round(value)),
      },
    });
  }

  _handleEndMoveEventDocument() {
    const hand = this._movingHand;

    if (this._mousemove) {
      if (hand) {
        EventHandlerMulti.off(hand, 'mouseup touchend', this._onHandMouseUp);
      }

      this.hands.forEach((hand) => {
        Manipulator.removeClass(hand, SELECTOR_ACTIVE);

        if (this._options.tooltip) Manipulator.removeClass(hand.children[1], 'active');
      });

      this._mousemove = false;
    }

    EventHandler.trigger(hand, EVENT_END, { hand });
    this._movingHand = null;

    EventHandlerMulti.off(document, 'mousemove touchmove', this._onDocumentMouseMove);

    this._enableTextSelection();
  }

  _handleEndMoveEvent(ev) {
    const hand = ev.target.closest(CLASSNAME_HAND);

    Manipulator.removeClass(hand, SELECTOR_ACTIVE);

    if (this._options.tooltip) Manipulator.removeClass(hand.children[1], 'active');

    this._mousemove = false;

    this._enableTextSelection();
  }

  _handleClickOnRange(ev) {
    this.hands.forEach((hand) => {
      this._mousemove = true;
      if (this._options.numberOfRanges < 2) {
        Manipulator.addClass(hand, SELECTOR_ACTIVE);
        Manipulator.addStyle(hand, {
          transform: `translate(${
            getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2
          }px,-25%)`,
        });
      } else {
        const firstHand = this.hands[0];
        Manipulator.addClass(firstHand, SELECTOR_ACTIVE);

        const translation = getEventTypeClientX(ev) - this.leftConnectRect - hand.offsetWidth / 2;

        const currentHandle = parseInt(Manipulator.getDataAttribute(firstHand, 'handle'), 10);
        let canMove = true;

        for (let i = 1; i < this.hands.length; i++) {
          const otherHand = this.hands[i];
          const otherTranslation = parseFloat(
            Manipulator.getDataAttribute(otherHand, 'translation')
          );
          const otherHandle = parseInt(Manipulator.getDataAttribute(otherHand, 'handle'), 10);

          if (currentHandle < otherHandle && translation > otherTranslation) {
            canMove = false;
            break;
          }
          if (currentHandle > otherHandle && translation < otherTranslation) {
            canMove = false;
            break;
          }
        }

        if (canMove) {
          Manipulator.addStyle(firstHand, {
            transform: `translate(${translation}px,-25%)`,
          });
          Manipulator.setDataAttribute(firstHand, 'translation', translation);
        }
      }
    });
  }

  _disableTextSelection() {
    document.body.style.userSelect = 'none';
  }

  _enableTextSelection() {
    document.body.style.userSelect = '';
  }

  static jQueryInterface(config, options) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose|hide/.test(config)) {
        return;
      }

      if (!data) {
        data = new MultiRangeSlider(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config](options);
      }
    });
  }

  _getConfig(options) {
    const config = {
      ...Default,
      ...Manipulator.getDataAttributes(this._element),
      ...options,
    };
    typeCheckConfig(NAME, config, DefaultType);
    return config;
  }
}

export default MultiRangeSlider;
