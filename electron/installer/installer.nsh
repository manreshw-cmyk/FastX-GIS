!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh

!define FASTX_ASSET_DIR "${BUILD_RESOURCES_DIR}\installer\assets"
!define FASTX_LICENSE_TEXT "FastX GIS 使用协议与开源说明$\r$\n$\r$\n一、软件说明$\r$\nFastX GIS 是由开源作者维护的三维 GIS 演示软件与 FastX SDK 配套桌面应用。软件围绕 Cesium 三维地图能力进行封装，提供图层渲染、标绘、测量分析、特效、插件扩展和 API 手册等能力。$\r$\n$\r$\n二、开源信息$\r$\n开源者：shihongwei$\r$\n开源时间：2026 年$\r$\n联系邮箱：shihongwei9898@163.com$\r$\n$\r$\n三、允许事项$\r$\n1. 允许个人学习、技术验证、项目演示和非商业研究使用。$\r$\n2. 允许在保留原作者信息、开源说明和版权声明的前提下进行二次开发。$\r$\n3. 商用合作、商业集成、定制开发、培训交付等场景，请提前通过邮箱联系作者确认授权方式。$\r$\n$\r$\n四、限制事项$\r$\n1. 未经作者书面许可，不允许将本软件、安装包、SDK 或基于本项目整理的交付物进行私自牟利、售卖、转售、收费分发或包装成闭源商业产品。$\r$\n2. 不允许删除、隐藏或篡改软件中的作者信息、开源说明、版权声明和 API 文档来源。$\r$\n3. 不允许以本软件名义进行违法违规、攻击破坏、数据窃取或侵犯第三方权益的行为。$\r$\n$\r$\n五、违约与处理$\r$\n如发现未经授权的牟利、售卖、收费分发、恶意篡改或侵权使用，作者有权要求立即停止使用、下架相关内容、公开澄清来源，并保留进一步追究责任的权利。因违规使用造成的法律、经济和数据风险，由违规使用者自行承担。$\r$\n$\r$\n继续安装即表示您已阅读、理解并同意遵守以上说明。"
!define FASTX_TEXT_COLOR 0x1F2937
!define FASTX_SUB_TEXT_COLOR 0x64748B
!define FASTX_ACCENT_COLOR 0x0EA5A3
!define FASTX_ACCENT_DARK_COLOR 0x0F766E
!define FASTX_WARNING_COLOR 0xDC2626
!define FASTX_PANEL_BG_COLOR 0xF8FAFC
!define FASTX_SOFT_BG_COLOR 0xECFDF5
!define FASTX_MULTILINE_STYLE ${DEFAULT_STYLES}|${WS_TABSTOP}|${WS_VSCROLL}|${ES_MULTILINE}|${ES_AUTOVSCROLL}|${ES_READONLY}|${ES_WANTRETURN}

!ifndef BUILD_UNINSTALLER
  Var FastXAgreementCheckbox
  Var FastXAgreementState
  Var FastXLicenseBuffer
  Var FastXSidebarImage
  Var FastXSidebarImageHandle
!else
  Var FastXUninstallImage
  Var FastXUninstallImageHandle
!endif
Var FastXTitleFont
Var FastXSubTitleFont
Var FastXSmallFont

!macro FastXSetNextButton LABEL
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:${LABEL}"
!macroend

!macro FastXSetBackButton LABEL
  GetDlgItem $0 $HWNDPARENT 3
  SendMessage $0 ${WM_SETTEXT} 0 "STR:${LABEL}"
!macroend

!macro FastXCreateTitle X Y WIDTH TEXT
  ${NSD_CreateLabel} ${X}u ${Y}u ${WIDTH}u 28u "${TEXT}"
  Pop $0
  SetCtlColors $0 ${FASTX_TEXT_COLOR} transparent
  CreateFont $FastXTitleFont "Microsoft YaHei UI" 16 700
  SendMessage $0 ${WM_SETFONT} $FastXTitleFont 1
!macroend

!macro FastXCreateSubTitle X Y WIDTH TEXT
  ${NSD_CreateLabel} ${X}u ${Y}u ${WIDTH}u 14u "${TEXT}"
  Pop $0
  SetCtlColors $0 ${FASTX_ACCENT_COLOR} transparent
  CreateFont $FastXSubTitleFont "Microsoft YaHei UI" 9 600
  SendMessage $0 ${WM_SETFONT} $FastXSubTitleFont 1
!macroend

!macro FastXCreateBody X Y WIDTH HEIGHT TEXT
  ${NSD_CreateLabel} ${X}u ${Y}u ${WIDTH}u ${HEIGHT}u "${TEXT}"
  Pop $0
  SetCtlColors $0 ${FASTX_TEXT_COLOR} transparent
  CreateFont $FastXSmallFont "Microsoft YaHei UI" 9 400
  SendMessage $0 ${WM_SETFONT} $FastXSmallFont 1
!macroend

!macro FastXCreateMuted X Y WIDTH HEIGHT TEXT
  ${NSD_CreateLabel} ${X}u ${Y}u ${WIDTH}u ${HEIGHT}u "${TEXT}"
  Pop $0
  SetCtlColors $0 ${FASTX_SUB_TEXT_COLOR} transparent
  CreateFont $FastXSmallFont "Microsoft YaHei UI" 8 400
  SendMessage $0 ${WM_SETFONT} $FastXSmallFont 1
!macroend

!ifndef BUILD_UNINSTALLER
  Function FastXWelcomePageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    File /oname=$PLUGINSDIR\fastx-installer-sidebar.bmp "${FASTX_ASSET_DIR}\installer-sidebar.bmp"
    ${NSD_CreateBitmap} 0u 0u 114u 193u ""
    Pop $FastXSidebarImage
    ${NSD_SetStretchedImage} $FastXSidebarImage "$PLUGINSDIR\fastx-installer-sidebar.bmp" $FastXSidebarImageHandle

    !insertmacro FastXCreateSubTitle 118 8 194 "FastX GIS Desktop"
    !insertmacro FastXCreateTitle 118 24 194 "您准备好遨游 GIS 世界了吗？"
    !insertmacro FastXCreateBody 118 56 194 45 "极速驱动 Cesium，大场景三维地图高效渲染。$\r$\n快览天地万象，速筑数字空间。$\r$\n高性能三维引擎，毫秒响应，实景漫游无卡顿。"
    ${NSD_CreateGroupBox} 118u 106u 194u 72u "安装向导"
    Pop $1
    SetCtlColors $1 ${FASTX_ACCENT_DARK_COLOR} transparent
    !insertmacro FastXCreateMuted 130 124 170 38 "将完成协议确认、安装目录选择、程序部署、快捷方式创建和运行校验。$\r$\n请点击底部“开始安装”继续。"

    !insertmacro FastXSetNextButton "开始安装"
    nsDialogs::Show

    ${NSD_FreeImage} $FastXSidebarImageHandle
  FunctionEnd

  Function FastXLicensePageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    !insertmacro FastXCreateTitle 0 0 312 "使用协议与开源说明"
    !insertmacro FastXCreateMuted 0 24 312 14 "请滚动阅读协议内容，勾选同意后继续安装。"

    StrCpy $FastXLicenseBuffer "${FASTX_LICENSE_TEXT}"
    nsDialogs::CreateControl EDIT ${FASTX_MULTILINE_STYLE} ${WS_EX_CLIENTEDGE} 0u 42u 312u 78u ""
    Pop $1
    SendMessage $1 ${EM_SETREADONLY} 1 0
    SendMessage $1 ${EM_SETBKGNDCOLOR} 0 ${FASTX_PANEL_BG_COLOR}
    ${NSD_SetText} $1 "$FastXLicenseBuffer"

    ${NSD_CreateCheckbox} 0u 128u 312u 14u "同意协议，已阅读 FastX GIS 使用协议与开源说明"
    Pop $FastXAgreementCheckbox
    SetCtlColors $FastXAgreementCheckbox ${FASTX_TEXT_COLOR} transparent
    !insertmacro FastXCreateMuted 0 148 312 14 "勾选后可点击底部“我同意，继续”进入安装目录选择。"

    !insertmacro FastXSetBackButton "上一步"
    !insertmacro FastXSetNextButton "我同意，继续"
    nsDialogs::Show
  FunctionEnd

  Function FastXLicensePageLeave
    ${NSD_GetState} $FastXAgreementCheckbox $FastXAgreementState
    ${If} $FastXAgreementState != ${BST_CHECKED}
      MessageBox MB_ICONEXCLAMATION "请先勾选同意 FastX GIS 使用协议与开源说明，然后继续安装。"
      Abort
    ${EndIf}
  FunctionEnd

  Function FastXReadyPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    !insertmacro FastXCreateTitle 0 0 312 "安装确认"
    !insertmacro FastXCreateMuted 0 25 312 16 "请确认安装信息，向导将在下一步开始写入文件。"

    ${NSD_CreateGroupBox} 0u 48u 312u 100u "安装信息"
    Pop $1
    SetCtlColors $1 ${FASTX_ACCENT_DARK_COLOR} transparent

    !insertmacro FastXCreateBody 12 68 288 12 "安装目录：$INSTDIR"
    !insertmacro FastXCreateBody 12 88 288 12 "预计所需空间：建议预留 2 GB 以上磁盘空间"
    !insertmacro FastXCreateBody 12 108 288 12 "安装内容：桌面程序、Cesium 资源、FastX GIS 演示页面、API 接口手册"
    !insertmacro FastXCreateMuted 12 128 288 10 "安装过程中将创建开始菜单和桌面快捷方式，并写入标准卸载信息。"

    !insertmacro FastXCreateMuted 0 154 312 22 "点击底部“开始部署”后，安装向导会显示实时进度和详细写入信息。"

    !insertmacro FastXSetBackButton "上一步"
    !insertmacro FastXSetNextButton "开始部署"
    nsDialogs::Show
  FunctionEnd

  !macro customWelcomePage
    Page custom FastXWelcomePageCreate
  !macroend

  !macro licensePage
    Page custom FastXLicensePageCreate FastXLicensePageLeave
  !macroend

  !macro customPageAfterChangeDir
    Page custom FastXReadyPageCreate
  !macroend

  !macro customFinishPage
    !ifndef HIDE_RUN_AFTER_FINISH
      Function FastXStartApp
        ${If} ${isUpdated}
          StrCpy $1 "--updated"
        ${Else}
          StrCpy $1 ""
        ${EndIf}
        ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
      FunctionEnd

      !define MUI_FINISHPAGE_RUN
      !define MUI_FINISHPAGE_RUN_FUNCTION "FastXStartApp"
      !define MUI_FINISHPAGE_RUN_TEXT "立即运行 FastX GIS"
    !endif

    !define MUI_FINISHPAGE_TITLE "FastX GIS 安装完成"
    !define MUI_FINISHPAGE_TEXT "FastX GIS 已成功部署到您的电脑。您可以通过桌面快捷方式或开始菜单启动软件，进入三维 GIS 演示、FastX SDK 能力展示和 API 接口手册。"
    !define MUI_FINISHPAGE_LINK "商用合作 / 问题反馈：shihongwei9898@163.com"
    !define MUI_FINISHPAGE_LINK_LOCATION "mailto:shihongwei9898@163.com"
    !define MUI_FINISHPAGE_LINK_COLOR "0EA5A3"
    !insertmacro MUI_PAGE_FINISH
  !macroend
!else
  Function un.FastXUnWelcomePageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    File /oname=$PLUGINSDIR\fastx-uninstaller-sidebar.bmp "${FASTX_ASSET_DIR}\uninstaller-sidebar.bmp"
    ${NSD_CreateBitmap} 0u 0u 114u 193u ""
    Pop $FastXUninstallImage
    ${NSD_SetStretchedImage} $FastXUninstallImage "$PLUGINSDIR\fastx-uninstaller-sidebar.bmp" $FastXUninstallImageHandle

    !insertmacro FastXCreateSubTitle 124 14 188 "FastX GIS Desktop"
    !insertmacro FastXCreateTitle 124 32 188 "卸载 FastX GIS"
    !insertmacro FastXCreateBody 124 66 188 42 "卸载向导将移除 FastX GIS 程序文件、快捷方式、安装注册信息和相关桌面入口。"
    ${NSD_CreateGroupBox} 124u 116u 188u 42u "卸载提醒"
    Pop $1
    SetCtlColors $1 ${FASTX_WARNING_COLOR} transparent
    !insertmacro FastXCreateMuted 136 132 164 16 "继续前请确认项目资料、二次开发代码或外部数据未放置在安装目录内。"

    !insertmacro FastXSetNextButton "开始卸载"
    nsDialogs::Show

    ${NSD_FreeImage} $FastXUninstallImageHandle
  FunctionEnd

  !macro customUnWelcomePage
    UninstPage custom un.FastXUnWelcomePageCreate
  !macroend

  !macro customUninstallPage
    !define MUI_FINISHPAGE_TITLE "FastX GIS 已完成卸载"
    !define MUI_FINISHPAGE_TEXT "FastX GIS 程序主体、快捷方式和卸载注册信息已处理完成。感谢您使用 FastX GIS。$\r$\n$\r$\n如后续需要重新安装，请重新运行 FastX GIS 安装程序。商用合作或问题反馈可联系：shihongwei9898@163.com"
    !define MUI_FINISHPAGE_LINK "商用合作 / 问题反馈：shihongwei9898@163.com"
    !define MUI_FINISHPAGE_LINK_LOCATION "mailto:shihongwei9898@163.com"
    !define MUI_FINISHPAGE_LINK_COLOR "0EA5A3"
  !macroend
!endif

!macro customHeader
  ShowInstDetails show
  ShowUnInstDetails show
  AutoCloseWindow false
  XPStyle on
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "FastX GIS 安装流程已进入收尾校验阶段。"
  DetailPrint "正在校验应用目录、运行入口和 Electron 桌面运行环境..."
  DetailPrint "正在确认 Cesium 三维引擎资源与 FastX GIS 业务页面写入结果..."
  DetailPrint "正在确认 API 接口手册、静态示例资源和配置文件写入结果..."
  DetailPrint "正在创建桌面快捷方式与开始菜单入口..."
  DetailPrint "正在写入系统卸载信息，便于后续通过控制面板或设置页卸载..."
  DetailPrint "正在整理安装状态并完成最终校验..."
  DetailPrint "FastX GIS 安装完成。"
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "FastX GIS 卸载流程已进入收尾校验阶段。"
  DetailPrint "正在移除应用运行入口和桌面程序文件..."
  DetailPrint "正在移除桌面快捷方式与开始菜单入口..."
  DetailPrint "正在清理安装注册信息和卸载记录..."
  DetailPrint "正在校验安装目录剩余内容，保留非安装器创建的用户文件..."
  DetailPrint "FastX GIS 卸载完成。"
!macroend
