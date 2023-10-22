// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import '../OrderStructs.sol';
import '../plugins/IPlugin.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @notice Stores the addresses of plugins that should be called in certain moments
 * when performing transactions in FundSwap
 */
struct PluginsToRun {
  EnumerableSet.AddressSet beforeOrderCreation;
  EnumerableSet.AddressSet afterOrderCreation;
  EnumerableSet.AddressSet beforeOrderFill;
  EnumerableSet.AddressSet afterOrderFill;
  EnumerableSet.AddressSet beforeOrderCancel;
  EnumerableSet.AddressSet afterOrderCancel;
}

/**
 * @notice Library for managing orders
 */
library PluginLib {
  using EnumerableSet for EnumerableSet.AddressSet;

  /**
   * @notice Stores the plugin call config so it is easy to query when performing transactions
   * @param pluginsToRun storage variable to write to
   * @param plugin new plugin that is going to be appended to the call config
   */
  function storePluginCallConfig(
    PluginsToRun storage pluginsToRun,
    IPlugin plugin
  ) internal {
    PluginCallsConfig memory pluginCallsConfig = plugin.getCallsConfig();
    if (pluginCallsConfig.beforeOrderCreation) {
      pluginsToRun.beforeOrderCreation.add(address(plugin));
    }
    if (pluginCallsConfig.afterOrderCreation) {
      pluginsToRun.afterOrderCreation.add(address(plugin));
    }
    if (pluginCallsConfig.beforeOrderFill) {
      pluginsToRun.beforeOrderFill.add(address(plugin));
    }
    if (pluginCallsConfig.afterOrderFill) {
      pluginsToRun.afterOrderFill.add(address(plugin));
    }
    if (pluginCallsConfig.beforeOrderCancel) {
      pluginsToRun.beforeOrderCancel.add(address(plugin));
    }
    if (pluginCallsConfig.afterOrderCancel) {
      pluginsToRun.afterOrderCancel.add(address(plugin));
    }
  }

  /**
   * @notice Removes the plugin call config so it is no longer going to be called when executing a transaction
   * @param pluginsToRun storage variable to write to
   * @param plugin old plugin that is going to be removed from the call config
   */
  function removePluginCallConfig(
    PluginsToRun storage pluginsToRun,
    IPlugin plugin
  ) internal {
    PluginCallsConfig memory pluginCallsConfig = plugin.getCallsConfig();
    if (pluginCallsConfig.beforeOrderCreation) {
      pluginsToRun.beforeOrderCreation.remove(address(plugin));
    }
    if (pluginCallsConfig.afterOrderCreation) {
      pluginsToRun.afterOrderCreation.remove(address(plugin));
    }
    if (pluginCallsConfig.beforeOrderFill) {
      pluginsToRun.beforeOrderFill.remove(address(plugin));
    }
    if (pluginCallsConfig.afterOrderFill) {
      pluginsToRun.afterOrderFill.remove(address(plugin));
    }
    if (pluginCallsConfig.beforeOrderCancel) {
      pluginsToRun.beforeOrderCancel.remove(address(plugin));
    }
    if (pluginCallsConfig.afterOrderCancel) {
      pluginsToRun.afterOrderCancel.remove(address(plugin));
    }
  }

  /**
   * @notice Calls all plugins that have a `beforeOrderCreation` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runBeforeOrderCreation(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.beforeOrderCreation.length(); i++) {
      result = IPlugin(pluginsToRun.beforeOrderCreation.at(i)).beforeOrderCreation(
        result
      );
    }
  }

  /**
   * @notice Calls all plugins that have a `afterOrderCreation` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runAfterOrderCreation(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.afterOrderCreation.length(); i++) {
      result = IPlugin(pluginsToRun.afterOrderCreation.at(i)).afterOrderCreation(result);
    }
  }

  /**
   * @notice Calls all plugins that have a `runBeforeOrderFill` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runBeforeOrderFill(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.beforeOrderFill.length(); i++) {
      result = IPlugin(pluginsToRun.beforeOrderFill.at(i)).beforeOrderFill(result);
    }
  }

  /**
   * @notice Calls all plugins that have a `runAfterOrderFill` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runAfterOrderFill(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.afterOrderFill.length(); i++) {
      result = IPlugin(pluginsToRun.afterOrderFill.at(i)).afterOrderFill(result);
    }
  }

  /**
   * @notice Calls all plugins that have a `runBeforeOrderCancel` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runBeforeOrderCancel(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.beforeOrderCancel.length(); i++) {
      result = IPlugin(pluginsToRun.beforeOrderCancel.at(i)).beforeOrderCancel(result);
    }
  }

  /**
   * @notice Calls all plugins that have a `runAfterOrderCancel` hook enabled. Result of a hook
   * is passed to the next hook in a line.
   * @param pluginsToRun config of plugins to run
   * @param order order that is currently being evaluated
   */
  function runAfterOrderCancel(
    PluginsToRun storage pluginsToRun,
    PublicOrder memory order
  ) internal returns (PublicOrder memory result) {
    result = order;
    for (uint i = 0; i < pluginsToRun.afterOrderCancel.length(); i++) {
      result = IPlugin(pluginsToRun.afterOrderCancel.at(i)).afterOrderCancel(result);
    }
  }
}
