// swift-tools-version: 5.9
import PackageDescription

// Empaquetado iOS del plugin.
//
// llama.cpp entra como binaryTarget, no como fuentes: es un proyecto CMake y
// SwiftPM no ejecuta CMake. El propio repositorio de llama.cpp trae el script
// que genera el xcframework; aquí se envuelve en
// scripts/build-ios-xcframework.sh, que hay que ejecutar UNA vez antes de
// abrir Xcode. El artefacto resultante no se versiona (pesa cientos de MB).
//
// La capa C++ compartida con Android se compila como target propio y se
// expone a Swift a través de una cabecera puramente C.
let package = Package(
    name: "KratcomLlamaNative",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "KratcomLlamaNative",
            targets: ["LlamaNativePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .binaryTarget(
            name: "llama",
            path: "ios/Frameworks/llama.xcframework"),
        .target(
            name: "KratcomLlamaCore",
            dependencies: ["llama"],
            path: "shared",
            sources: ["kratcom_llama.cpp"],
            publicHeadersPath: "include"),
        .target(
            name: "LlamaNativePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                "KratcomLlamaCore"
            ],
            path: "ios/Sources/LlamaNativePlugin")
    ]
)
