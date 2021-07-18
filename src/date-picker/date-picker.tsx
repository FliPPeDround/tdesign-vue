import debounce from 'lodash/debounce';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import props from './props';
import { TdDatePickerProps } from './type';

import CLASSNAMES from '../utils/classnames';

import Vue from 'vue';
import { clickOut } from '../utils/dom';
import { Button as TButton } from '../button';
import { Input as TInput } from '../input';
import TIconCalendar from '../icon/calendar';
import TIconTime from '../icon/time';
import TIconClose from '../icon/close';
import TPopup from '../popup';
import mixins from '../utils/mixins';
import getLocalRecevierMixins from '../locale/local-receiver';

import { CustomLocale, DatePickerInstance, DateValue } from './interface';
import { COMPONENT_NAME } from './constants';
import CalendarPresets from './calendar-presets';
import TDate from './panel/date';
import TDateRange from './panel/date-range';
import TTimePickerPanel from '../time-picker/panel';
import { EPickerCols } from '../time-picker/constant';
import { dateIndexOf, firstUpperCase } from './utils';
import EmbedTo from './embed-to';
import { TimePickerPanelInstance } from '../time-picker';

dayjs.extend(isBetween);

const onOpenDebounce = debounce((vm?: any) => {
  vm.createPopover();
}, 250);

export default mixins(getLocalRecevierMixins<TdDatePickerProps & DatePickerInstance>('datePicker')).extend({
  name: COMPONENT_NAME,
  components: {
    TIconTime,
    TIconCalendar,
    TIconClose,
    TPopup,
    TButton,
    TInput,
    CalendarPresets,
    TDate,
    TDateRange,
    TTimePickerPanel,
  },
  directives: { EmbedTo },
  props: {
    ...props,
  },
  data() {
    return {
      tempValue: '',
      locales: {},
      monthDate: new Date(),
      start: new Date(),
      end: new Date(),
      selectedDates: [],
      inSelection: false,
      inline: false,
      dateFormat: '',
      multiSeparator: ',',
      foundation: null,
      inlineView: false,
      showTime: false,
      els: [],
      isOpen: false,
      timeVlaue: dayjs(),
    };
  },
  computed: {
    inputListeners() {
      return {
        ...this.$listeners,
        focus: this.onNativeFocus,
        input: this.onNativeInput,
        click: this.onClick,
      };
    },
    startText(): string {
      return this.formatDate(this.start);
    },
    endText(): string {
      return this.formatDate(this.end);
    },
    formattedValue: {
      get() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const vm: any = this;
        const { tempValue, range, mode, isOpen, startText, endText, locales, selectedDates } = vm;
        const selectedFmtDates: string[] = selectedDates.map((d: Date) => vm.formatDate(d));

        if (tempValue) {
          return tempValue;
        }

        const strMode: string = range ? 'range' : mode;
        let value = '';

        switch (strMode) {
          case 'time':
          case 'date':
          case 'month':
          case 'year':
            value = selectedFmtDates.join('');
            break;
          case 'range':
            if (isOpen) {
              value = [startText, endText].join(locales.rangeSeparator);
            } else if (selectedFmtDates.length > 1) {
              value = [selectedFmtDates[0], selectedFmtDates[1]].join(locales.rangeSeparator);
            }
            break;
        }

        return value;
      },
      set(value: dayjs.ConfigType) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const vm: any = this;
        const { min, dateFormat } = vm;
        if (value) {
          if (String(value).length >= String(vm.formatDate(min || new Date())).length && dayjs(value, dateFormat)) {
            vm.tempValue = '';
            vm.setDate(value, true);
          } else {
            vm.tempValue = value;
          }
        }
      },
    },
    rangeText: {
      get() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const vm: any = this;
        let range = vm.startText;
        if (vm.range) {
          range += ` ${vm.locales.rangeSeparator} ${vm.endText}`;
        }
        return range;
      },
      set(value) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const vm: any = this;
        if (vm.value) {
          vm.setDate(value, false);
        }
      },
    },
    min() {
      const disableDate: any = this.disableDate || {};
      const { before } = disableDate;
      return before ? new Date(before) : null;
    },
    max() {
      const disableDate: any = this.disableDate || {};
      const { after } = disableDate;
      return after ? new Date(after) : null;
    },
    classes(): any {
      return [
        't-date-picker',
        't-input',
        CLASSNAMES.SIZE[this.size] || '',
        {
          't-date-picker--month-picker': this.mode === 'year' || this.mode === 'month',
          't-inline': this.inline || this.inlineView,
        },
      ];
    },
    pickerStyles() {
      return {
        't-date-picker--container': true,
        't-date-picker-picker--open': this.isOpen || this.inlineView,
        't-date-picker--calendar-inline-view': this.inlineView,
        't-date-picker--ranges-show': !!this.presets && this.range,
        't-date-picker--date': this.mode === 'date',
      };
    },
  },

  watch: {
    value(value, oldValue) {
      if ((!this.isOpen || this.inlineView) && oldValue && String(value) !== String(oldValue)) {
        this.setDate(value, false);
      }
      if (String(value) !== String(oldValue)) {
        this.$emit('change', value);
      }
    },
  },
  mounted() {
    this.attachDatepicker();
  },
  methods: {
    handleTimePick(col: EPickerCols, time: number) {
      const start = new Date(this.start);
      start[`set${firstUpperCase(col)}s`](time);
      this.start = start;
      this.timeVlaue = dayjs(start);
      this.dateClick(new Date(start));
    },
    initClickaway(el: Element) {
      this.els.push(el);
      if (this.els.length > 1) {
        clickOut(this.els, () => {
          this.clickAway();
        });
      }
    },
    attachDatepicker(): any {
      // language init
      this.setLocales();

      this.initClickaway(this.$el);
      const startDate: Date = new Date();
      const endDate: Date = new Date();

      this.dateFormat = this.format;

      const start = new Date(startDate);
      let end = new Date(endDate);

      if (!this.range) {
        // ignore endDate for not range DatePicker
        end = new Date(startDate);
      }

      this.start = start;
      this.end = end;

      const val = this.value || this.defaultValue || '';
      this.setDate(val, false);
      if (this.inlineView) {
        this.open();
      }
    },
    getLocales(): CustomLocale {
      const locales = this.locale as Record<string, any>;
      locales.rangeSeparator = locales.rangeSeparator;
      locales.daysOfWeek = locales.weekdays.shorthand.split(',');
      locales.monthNames = locales.months.shorthand.split(',');

      if (this.mode === 'month') {
        locales.monthNames = locales.months.longhand.split(',');
      }

      // update day names order to firstDay
      if (locales.firstDayOfWeek !== 0) {
        let iterator = locales.firstDayOfWeek;
        while (iterator > 0) {
          locales.daysOfWeek.push(locales.daysOfWeek.shift());
          iterator = iterator - 1;
        }
      }
      return locales;
    },
    setLocales() {
      const locales = this.getLocales();
      this.locales = locales;
    },
    /**
     * Watch for value changed by date-picker itself and notify parent component
     *
     * @param event
     */
    onNativeInput(event?: any): void {
      const val: any = event.target.value;
      this.formattedValue = val;
      const d1: any = this.parseDate(val);

      if (d1 instanceof Date) {
        const d2: string = this.formatDate(d1);
        this.$emit('input', d2);
      }
    },
    onNativeFocus(event?: MouseEvent): void {
      if (!this.isOpen) {
        this.open();
      }
      this.$emit('focus', event);
    },
    onClick(event?: MouseEvent): void {
      if (!this.isOpen) {
        this.open();
      }
      this.$emit('click', event);
    },

    normalizeDatetime(value: Date, oldValue: Date): Date {
      const newDate = dayjs(value);
      const oldDate = dayjs(oldValue);
      if (this.enableTimePicker) {
        newDate.hour(oldDate.hour());
        newDate.minute(oldDate.minute());
        newDate.second(oldDate.second());
        newDate.millisecond(oldDate.millisecond());
      }

      return newDate.toDate();
    },

    dateClick(value: Date) {
      // @todo add year range and month range
      let mode = this.range ? 'range' : this.mode;

      if (this.showTime) {
        mode = 'time';
      }

      switch (mode) {
        case 'time':
          this.selectedDates = this.range ? [this.start, this.end] : [value];
          this.clickedApply(false);
          break;
        case 'year':
        case 'month':
        case 'date':
          this.start = this.normalizeDatetime(value, this.start);
          this.selectedDates = [this.start];
          // 有时间选择时，点击日期不关闭弹窗
          this.clickedApply(!this.enableTimePicker);
          break;
        case 'range':
          if (this.inSelection) {
            this.inSelection = false;
            this.start = this.normalizeDatetime(value[0], this.end);
            this.end = this.normalizeDatetime(value[1], this.end);

            if (this.end < this.start) {
              this.inSelection = true;
              this.start = this.normalizeDatetime(value[0], this.start);
            }
          } else {
            this.start = this.normalizeDatetime(value[0], this.start);
            this.end = this.normalizeDatetime(value[1], this.end);
            this.inSelection = true;
          }
          break;
      }
    },
    hoverDate(value: Date) {
      const dt = this.normalizeDatetime(value, this.end);
      if (this.inSelection && dt > this.start) {
        this.end = dt;
      }
    },
    toggle() {
      if (!this.disabled) {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    },
    open() {
      if (!this.disabled) {
        const { formattedValue } = this;
        // set default value;
        if (formattedValue) {
          this.setDate(formattedValue);
        }
        this.tempValue = '';
        // open
        this.isOpen = true;
        this.$nextTick(() => {
          onOpenDebounce(this);
          this.$emit('open', this.selectedDates);
        });
      }
    },
    close() {
      if (!this.disabled) {
        this.tempValue = '';
        this.isOpen = false;
        this.showTime = false;
        this.$emit('close', this.selectedDates);
      }
    },
    clickedApply(closePicker = true): void {
      if (this.range) {
        this.selectedDates = [this.start, this.end];
      }

      const selectedDates = this.selectedDates.map((d: Date) => {
        const fd = this.formatDate(d);
        return fd;
      });
      // submit formate date
      this.submitInput(selectedDates, true);
      if (closePicker) {
        this.close();
      }
    },
    toggleTime() {
      this.timeVlaue = dayjs(this.start);

      this.showTime = !this.showTime;
      this.$nextTick(() => {
        const timePickerPanel = this.$refs.timePickerPanel as TimePickerPanelInstance;
        timePickerPanel && timePickerPanel.panelColUpate();
      });
    },

    clickAway() {
      if (this.isOpen) {
        // reset start and end
        const { selectedDates } = this;
        if (selectedDates.length > 1) {
          this.start = new Date(selectedDates[0]);
          this.end = new Date(selectedDates[1]);
        }
        this.close();
      }
    },
    clickRange(value: DateValue, autoApply = false) {
      if (Array.isArray(value)) {
        const [start, end] = value as dayjs.ConfigType[];
        this.start = dayjs(start).toDate();
        this.end = dayjs(end || start).toDate();
        this.monthDate = dayjs(start).toDate();
      } else {
        this.start = dayjs(value).toDate();
        this.end = dayjs(value).toDate();
        this.monthDate = dayjs(value).toDate();
      }
      if (autoApply) {
        this.clickedApply();
      }
    },
    clear(triggerChange = false): void {
      // close picker
      this.close();

      // set value
      if (!this.disabled) {
        const selectedDates: any[] = [];
        this.selectedDates = selectedDates;
        this.formattedValue = '';
        this.submitInput(selectedDates, triggerChange);
      }
    },
    submitInput(selectedDates: any[], triggerChange = true) {
      const { multiSeparator } = this;
      const mode = this.range ? 'range' : this.mode;

      switch (mode) {
        case 'date':
        case 'month':
        case 'year':
          // submit formate date
          this.$emit('input', selectedDates.join(multiSeparator));
          if (triggerChange) {
            this.$emit('change', selectedDates.join(multiSeparator));
          }
          break;
        case 'range':
          // submit formate date
          this.$emit('input', selectedDates);
          if (triggerChange) {
            this.$emit('change', selectedDates);
          }
          break;
      }
    },
    parseDate(value: any = '', format = ''): Date | boolean {
      if (value instanceof Date) {
        return new Date(value);
      }
      if (format) {
        const oDate: dayjs.Dayjs = dayjs(value, format);
        if (oDate.isValid()) {
          return new Date(oDate.toDate());
        }
        return false;
      }

      const d2: dayjs.Dayjs = dayjs(value);
      if (d2.isValid()) {
        return new Date(d2.toDate());
      }
      return false;
    },
    isEnabled(value: Date): boolean {
      const { min, max, disableDate } = this;
      if (!disableDate) {
        return true;
      }
      // 值类型为 Function 则表示返回值为 true 的日期会被禁用
      if (typeof disableDate === 'function') {
        return !disableDate(value);
      }

      // 禁用日期，示例：['A', 'B'] 表示日期 A 和日期 B 会被禁用。
      if (Array.isArray(disableDate)) {
        return dateIndexOf(value, disableDate) < 0;
      }

      // { before: 'A', after: 'B' } 表示在 A 之前和在 B 之后的日期都会被禁用。
      if (max && min) {
        const compareMin = dayjs(new Date(min)).startOf('day');
        const compareMax = dayjs(new Date(max)).startOf('day');

        // check min
        return dayjs(value).isBetween(compareMin, compareMax, null, '[]');
      }

      // { from: 'A', to: 'B' } 表示在 A 到 B 之间的日期会被禁用。
      const { from, to } = disableDate;
      if (from && to) {
        const compareMin = dayjs(new Date(from)).startOf('day');
        const compareMax = dayjs(new Date(to)).startOf('day');

        // check min
        return !dayjs(value).isBetween(compareMin, compareMax, null, '[]');
      }

      return true;
    },
    setDate(inputDate: any = '', triggerChange = false): void {
      if ((inputDate !== 0 && !inputDate) || (inputDate instanceof Array && inputDate.length === 0)) {
        return this.clear(triggerChange);
      }

      const format = this.dateFormat || '';

      let dates: any[] = [];
      if (inputDate instanceof Array) {
        dates = inputDate.map((d) => {
          const d1 = this.parseDate(d, format);
          return d1;
        });
      } else if (inputDate instanceof Date || typeof inputDate === 'number') {
        dates = [this.parseDate(inputDate, format)];
      } else if (typeof inputDate === 'string') {
        const mode = this.range ? 'range' : this.mode;

        switch (mode) {
          case 'date':
          case 'month':
          case 'year':
            dates = [this.parseDate(inputDate, format)];
            break;

          case 'range':
            dates = inputDate.split(this.locales.rangeSeparator || '-').map((d) => {
              const d1 = this.parseDate(d, format);
              return d1;
            });

            break;

          default:
            break;
        }
      }
      const selectedDates = dates.filter((d) => {
        const isEnable = d instanceof Date && this.isEnabled(d);
        return isEnable;
      });
      selectedDates.sort((a, b) => a.getTime() - b.getTime());

      this.selectedDates = selectedDates;
      if (selectedDates.length > 0) {
        const [start, end] = selectedDates;
        this.start = start;
        this.end = end || start;
      }
    },
    formatDate(date: Date, format = ''): string {
      let dateFormat = format || this.dateFormat || this.locales.format;
      const arrTime = ['H', 'h', 'm', 's'];
      const hasTime = arrTime.some((f) => {
        const includesTime = String(dateFormat).includes(f);
        return includesTime;
      });
      if (this.enableTimePicker && !hasTime) {
        dateFormat = [dateFormat, 'HH:mm:ss'].join(' ');
      }
      const d1 = new Date(date);
      return dayjs(d1).format(dateFormat);
    },

    createPopover() {
      if (this.inlineView) {
        return;
      }
      const nativeInput = this.$refs.native as Vue;

      const tip: HTMLElement = this.$refs.dropdownPopup as HTMLElement;
      const refEl: Element = ((nativeInput && nativeInput.$el) || this.$el) as Element;

      if (!tip || !refEl) {
        return;
      }

      this.initClickaway(tip);
    },
    getPlaceholderText() {
      const { placeholder, mode } = this.$props;

      return placeholder || (this.locales.placeholder && this.locales.placeholder[mode]);
    },
  },
  render() {
    const {
      popupProps,
      disabled,
      clearable,
      allowInput,
      size,
      inputProps,
      enableTimePicker,
      presets,
      mode,
      range,
    } = this.$props;

    const { start, end, showTime, timeVlaue, locales, isOpen } = this.$data;
    const panelProps = {
      value: range ? [start, end] : start,
      mode,
      firstDayOfWeek: 0,
      onChange: this.dateClick,
    };
    const panelComponent = range ? (
      <TDateRange {...{ props: { ...panelProps } }} />
    ) : (
      <TDate {...{ props: { ...panelProps } }} />
    );

    const popupContent = () => (
      <div ref="dropdownPopup" class={this.pickerStyles}>
        {enableTimePicker && showTime && (
          <div>
            <t-time-picker-panel
              ref="timePickerPanel"
              format="HH:mm:ss"
              cols={[EPickerCols.hour, EPickerCols.minute, EPickerCols.second]}
              steps={[1, 1, 1]}
              value={[timeVlaue]}
              ontime-pick={this.handleTimePick}
              isFooterDisplay={false}
            />
          </div>
        )
        }
        {!showTime && panelComponent}
        {presets !== false && range && (
          <calendar-presets presets={presets} locales={locales} {...{ props: { onClickRange: this.clickRange } }} />
        )}
        {
          (range || enableTimePicker) && (
            <div class="t-date-picker--apply">
              {
                enableTimePicker && (
                  <t-button theme="primary" variant="text" onClick={this.toggleTime}>
                    {showTime ? locales.selectDate : locales.selectTime}
                  </t-button>
                )
              }
              {
                (range || enableTimePicker) && (
                  <t-button theme="primary" onClick={this.clickedApply}>
                    {locales.confirm}
                  </t-button>
                )
              }
            </div>
          )
        }
      </div>
    );
    const inputClassNames = [
      't-form-controls',
      {
        [CLASSNAMES.STATUS.active]: this.isOpen,
      },
    ];
    return (
      <div class={this.classes}>
        <t-popup
          ref="popup"
          class="t-date-picker-popup-reference"
          trigger="click"
          placement="bottom-left"
          disabled={disabled}
          destroyOnClose
          showArrow={false}
          visible={isOpen}
          popupProps={popupProps}
          overlayClassName="t-date-picker"
          content={popupContent}
        >
          <div class={inputClassNames} onClick={this.toggle}>
            <t-input
              ref="native"
              v-model={this.formattedValue}
              disabled={disabled}
              clearable={clearable}
              placeholder={this.getPlaceholderText()}
              readonly={!allowInput}
              allowInput={allowInput ? 1 : 0}
              size={size}
              inputProps={inputProps}
              onClear={() => this.clear(true)}
              {...{ props: { ...this.inputListeners } }}
              suffixIcon={() => enableTimePicker ? <t-icon-time /> : <t-icon-calendar />}
            >
            </t-input>
          </div>
        </t-popup>
      </div>
    );
  },
});