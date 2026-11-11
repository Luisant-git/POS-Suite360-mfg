import React from 'react';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';

const CustomOption = (props: any) => {
  const { onMouseDown } = props.innerProps;
  return (
    <components.Option 
      {...props} 
      innerProps={{
        ...props.innerProps,
        onMouseDown: (e: any) => {
          e.preventDefault();
          e.stopPropagation();
          props.selectOption(props.data);
          if (onMouseDown) onMouseDown(e);
        }
      }}
    />
  );
};

export interface SelectOption {
  value: string | number;
  label: string;
  [key: string]: any;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number | null | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  disabled?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  isLoading?: boolean;
  autoFocus?: boolean;
  menuPlacement?: 'auto' | 'top' | 'bottom';
  creatable?: boolean;
  onCreate?: (name: string) => void;
  tabIndex?: number;
  onTabNext?: () => void;
  onShiftTab?: () => void;
  onEnterNext?: () => void;
  dataAttr?: Record<string, string>;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select / Search...',
  className = '',
  isDisabled = false,
  disabled = false,
  isClearable = true,
  isSearchable = true,
  isLoading = false,
  autoFocus = false,
  menuPlacement = 'auto',
  creatable = false,
  onCreate,
  tabIndex,
  onTabNext,
  onShiftTab,
  onEnterNext,
  dataAttr,
}) => {
  const activeDisabled = isDisabled || disabled;
  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || null;
  const menuOpenRef = React.useRef(false);
  const closedOnEscapeRef = React.useRef(false);

  const selectProps: any = {
    options,
    value: selectedOption,
    onChange: (opt: any) => {
      if (!opt) {
        onChange('');
      } else {
        onChange(opt.value);
      }
    },
    placeholder,
    isDisabled: activeDisabled,
    isClearable,
    isSearchable,
    isLoading,
    autoFocus,
    tabIndex: tabIndex ?? 0,
    openMenuOnFocus: true,
    className: `text-[13px] ${className}`,
    menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
    menuPosition: 'fixed',
    menuPlacement,
    menuShouldScrollIntoView: false,
    captureMenuScroll: false,
    closeMenuOnScroll: false,
    components: { Option: CustomOption },
    onMenuOpen: () => {
      menuOpenRef.current = true;
    },
    onMenuClose: () => {
      menuOpenRef.current = false;
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closedOnEscapeRef.current = menuOpenRef.current;
      } else if (e.key === 'Delete' && e.ctrlKey) {
        // Prevent react-select from clearing the selected value on Ctrl+Delete row shortcut
        e.preventDefault();
      }
    },
    styles: {
      control: (base: any, state: any) => ({
        ...base,
        minHeight: '38px',
        borderColor: state.isFocused ? '#3B82F6' : '#CBD5E1',
        boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
        '&:hover': {
          borderColor: '#94A3B8',
        },
        borderRadius: '0.375rem',
        backgroundColor: activeDisabled ? '#F3F4F6' : '#FFFFFF',
      }),
      singleValue: (base: any) => ({
        ...base,
        color: '#000000',
        fontWeight: '700',
        fontSize: '13px',
      }),
      input: (base: any) => ({
        ...base,
        color: '#000000',
        fontWeight: '700',
        fontSize: '13px',
      }),
      placeholder: (base: any) => ({
        ...base,
        color: '#94A3B8',
        fontSize: '13px',
      }),
      option: (base: any, state: any) => ({
        ...base,
        fontSize: '13px',
        fontWeight: state.isSelected ? '700' : '600',
        color: state.isSelected || state.isFocused ? '#FFFFFF' : '#000000',
        backgroundColor: state.isSelected ? '#2563EB' : state.isFocused ? '#3B82F6' : '#FFFFFF',
        cursor: 'pointer',
      }),
      menu: (base: any) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '0.375rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }),
      menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    }
  };

  const Component = creatable ? CreatableSelect : Select;
  if (creatable && onCreate) {
    selectProps.onCreateOption = onCreate;
  }

  const handleWrapperKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && closedOnEscapeRef.current) {
      closedOnEscapeRef.current = false;
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && onTabNext && !e.defaultPrevented) {
      e.preventDefault();
      onTabNext();
    } else if (e.key === 'Tab' && e.shiftKey && onShiftTab && !e.defaultPrevented) {
      e.preventDefault();
      onShiftTab();
    } else if (e.key === 'Enter' && onEnterNext && !e.defaultPrevented && !menuOpenRef.current) {
      e.preventDefault();
      onEnterNext();
    }
  };

  return (
    <div {...(dataAttr || {})} onKeyDown={handleWrapperKeyDown} className="w-full">
      <Component {...selectProps} />
    </div>
  );
};

export default SearchableSelect;
