# DSH host integration / 宿主集成

The plugin's default routing and uninstall restoration require the companion DSH changes in [dsh-config-effects.patch](dsh-config-effects.patch). The current unmodified host has no uninstall configuration transaction. Apply this patch to the matching DSH checkout, install its dependencies and rebuild DSH before enabling this plugin. These changes are already applied to the adjacent development checkout during this task; that does not update a separately installed `dsh` executable or a published release.

插件的默认路由和卸载恢复依赖 [dsh-config-effects.patch](dsh-config-effects.patch) 中的 DSH 改动。现有未修改宿主没有卸载配置事务。请向匹配的 DSH 源码应用补丁、安装依赖并重新构建，再启用插件。本任务已将改动应用到相邻开发仓库；这不等于更新了独立安装的 `dsh` 命令或已发布版本。

The manifest declares `configEffects`: `set` applies initial fields and `track` declares settings fields whose card writes update the journal. The journal lives in the profile YAML comment `dsh-config-effects/v1`. It records exact field presence/value and last writes, so values and ownership commit in one atomic file write. On removal, matching fields restore their baseline; later manual edits remain and produce conflicts. Overlapping bundle field ownership and duplicate profile config overrides are rejected.

Manifest 用 `configEffects` 声明变更：`set` 应用初始字段，`track` 指定卡片写入时需要更新账本的设置字段。账本保存在 profile YAML 的 `dsh-config-effects/v1` 注释中，记录字段是否存在、原值与最后写入值；字段和值的归属通过同一次文件原子写入提交。卸载时匹配的字段恢复基线，后续手动修改保留并报告冲突。不允许两个 bundle 同时拥有同一字段，也不允许目标行存在多个 profile 配置覆盖。

The Web API `searchWithProvider` dispatches to the registered official provider and enforces its availability and result limits. It retains that provider's existing configuration and logging. No dynamic import or new credentialed provider bypasses disablement.

Web 的 `searchWithProvider` 接口调用已注册的官方提供方，执行可用性检查和结果数量限制，保留它已有的配置与日志行为。不通过动态导入或创建新凭据实例绕过禁用设置。

Use the DSH manager for installation, enable/disable and removal. Restart/HMR only remount runtime effects and do not undo the journal. Home/CLI layers retain their normal priority. Raw package deletion bypasses the manager and requires subsequent reconciliation.

安装、启用/禁用和卸载需使用 DSH 管理流程。重启或 HMR 只重建运行时效果，不撤销账本。home/CLI 层保留正常优先级。直接删除包文件会绕过管理流程，需要后续协调恢复。
