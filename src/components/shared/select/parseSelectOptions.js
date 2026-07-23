import { Children, isValidElement, Fragment } from 'react';

export function parseSelectOptions(children) {
  const options = [];
  const optgroups = [];

  const processNode = (node, groupLabel = null) => {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach((child) => {
        processNode(child, groupLabel);
      });
      return;
    }

    if (isValidElement(node) && node.type === Fragment) {
      const fragmentChildren = Children.toArray(node.props?.children || []);
      fragmentChildren.forEach((child) => {
        processNode(child, groupLabel);
      });
      return;
    }

    if (!isValidElement(node)) return;

    if (node.type === 'optgroup') {
      const groupLabel = node.props?.label || '';
      const groupChildren = Children.toArray(node.props?.children || []);

      groupChildren.forEach((opt) => {
        processNode(opt, groupLabel);
      });
    } else if (node.type === 'option') {
      const optionData = {
        value: node.props.value,
        label:
          typeof node.props.children === 'string'
            ? node.props.children
            : String(node.props.children),
        group: groupLabel,
        title: node.props.title || null,
      };

      if (groupLabel) {
        let group = optgroups.find((g) => g.label === groupLabel);
        if (!group) {
          group = { label: groupLabel, options: [] };
          optgroups.push(group);
        }
        group.options.push(optionData);
      } else {
        options.push(optionData);
      }
    }
  };

  const flatChildren = Children.toArray(children);
  flatChildren.forEach((child) => {
    processNode(child);
  });

  return { options, optgroups };
}

export function filterSelectOptions(options, optgroups, searchQuery, searchable) {
  const q = searchQuery.trim().toLowerCase();
  if (!searchable || !q) {
    const count = options.length + optgroups.reduce((n, g) => n + g.options.length, 0);
    return { filteredOptions: options, filteredOptgroups: optgroups, filteredOptionCount: count };
  }

  const matches = (opt) => String(opt.label).toLowerCase().includes(q);
  const nextOptions = options.filter(matches);
  const nextOptgroups = optgroups.reduce((acc, group) => {
    const groupOptions = group.options.filter(matches);
    if (groupOptions.length > 0) {
      acc.push({ ...group, options: groupOptions });
    }
    return acc;
  }, []);
  const count = nextOptions.length + nextOptgroups.reduce((n, g) => n + g.options.length, 0);

  return {
    filteredOptions: nextOptions,
    filteredOptgroups: nextOptgroups,
    filteredOptionCount: count,
  };
}
