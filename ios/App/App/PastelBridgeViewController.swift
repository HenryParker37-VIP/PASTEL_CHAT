import Capacitor

final class PastelBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(PastelCallKitPlugin.self)
    }
}
