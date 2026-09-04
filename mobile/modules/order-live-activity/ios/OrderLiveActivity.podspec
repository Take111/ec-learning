# 注文 Live Activity 用ローカル Expo Module の Pod 定義。
# expo-modules-autolinking が mobile/modules/ を既定で走査するので、Podfile への手書きは不要。
# 前提: ActivityAttributes の実体は targets/order-activity/ にある1ファイル。本体側(この Pod)とウィジェット側で
#   同じ型定義を「複製せずに」持つため、ios/OrderActivityAttributes.swift はそのファイルへのシンボリックリンク。
#   podspec の source_files に "../../../targets/..." と書く方式は CocoaPods が Pod ルート外のパスを
#   黙って無視するため使えない(prebuild で実測)。リンクを消すと型が見つからずビルドが落ちるので気づける
Pod::Spec.new do |s|
  s.name           = 'OrderLiveActivity'
  s.version        = '1.0.0'
  s.summary        = '注文 Live Activity の開始・更新・終了(ActivityKit の薄い橋)'
  s.description    = 'ec-learning mobile: JS から ActivityKit を操作するローカル Expo Module'
  s.license        = 'MIT'
  s.author         = 'ec-learning'
  s.homepage       = 'https://github.com/Take111/ec-learning'
  # 本体アプリ(Podfile 既定 16.4)に揃える。ActivityKit の実用下限 16.2 を満たす
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
