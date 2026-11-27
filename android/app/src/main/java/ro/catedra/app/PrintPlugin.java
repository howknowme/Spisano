package ro.catedra.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tipărire nativă pe Android: încarcă documentul HTML într-un WebView ascuns
 * și deschide dialogul de tipărire al sistemului (inclusiv „Salvează ca PDF”).
 */
@CapacitorPlugin(name = "CatedraPrint")
public class PrintPlugin extends Plugin {
    private WebView printView; // păstrat până termină tipărirea

    @PluginMethod
    public void print(final PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "Catedra");
        getActivity().runOnUiThread(() -> {
            try {
                printView = new WebView(getActivity());
                printView.getSettings().setJavaScriptEnabled(false);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                        PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .build();
                        pm.print(name, adapter, attrs);
                        call.resolve();
                    }
                });
                printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
