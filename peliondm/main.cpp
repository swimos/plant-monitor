#include "mbed.h"
#include "mbed_events.h"
#include "mbed_trace.h"
#include "simple-mbed-cloud-client.h"
#include "SimulatorBlockDevice.h"
#include "eventOS_scheduler.h"
#include "mbed.h"
#include "C12832.h"
#include "Sht31.h"

C12832 lcd(SPI_MOSI, SPI_SCK, SPI_MISO, p8, p11);
Sht31 sht31(I2C_SDA, I2C_SCL);
DigitalOut led(LED1);
AnalogOut lightSensor(p15);
AnalogOut soilSensor(p16);
AnalogOut pressureSensor(p17);

SimulatorBlockDevice bd("myblockdevice", 128 * 512, 512);

// Declaring pointers for access to Pelion Device Management Client resources outside of main()
MbedCloudClientResource *button_res;
MbedCloudClientResource *pattern_res;

MbedCloudClientResource *light_res;
MbedCloudClientResource *soil_res;
MbedCloudClientResource *temp_res;
MbedCloudClientResource *humidity_res;
MbedCloudClientResource *pressure_res;

// This function gets triggered by the timer. It's easy to replace it by an InterruptIn and fall() mode on a real button
void fake_button_press() {
    int v = button_res->get_value_int() + 1;

    button_res->set_value(v);

    printf("Simulated button clicked %d times\n", v);
}

void light_change() {
    float light = lightSensor.read();

    if(light != 0.0f) {

        light_res->set_value(light*100);
        printf("light read as: %.1f \n", light*100);

    } else {
        int newDiff = rand() % 5 + 1;
        int v = 0;
        if((rand() % 2) == 1) {
                v = light_res->get_value_int() + newDiff;
        } else {
                v = light_res->get_value_int() - newDiff;
        }
        if(v > 100 || v < 0) {
            v = 50;
        }
        light_res->set_value(v);
        // printf("light change to: %d \n", v);

    }
}

void soil_change() {
    float soil = soilSensor.read();

    if(soil != 0.0f) {
        soil_res->set_value(soil*100);
        printf("soil read as: %.1f \n", soil*100);

    } else {
        int newDiff = rand() % 5 + 1;
        int v = 0;
        if((rand() % 2) == 1) {
                v = soil_res->get_value_int() + newDiff;
        } else {
                v = soil_res->get_value_int() - newDiff;
        }
        if(v > 100 || v < 0) {
            v = 50;
        }

        soil_res->set_value(v);
        printf("soil change to: %d \n", v);

    }

}
void temp_change() {
    float temp = sht31.readTemperature();

    if(temp != 0.0f) {
        temp_res->set_value(temp);
        printf("temp sensor read: %.1f \n", temp);
    } else {
        int newDiff = rand() % 5 + 1;
        int v = 0;
        if((rand() % 2) == 1) {
                v = temp_res->get_value_int() + newDiff;
        } else {
                v = temp_res->get_value_int() - newDiff;
        }
        if(v > 100 || v < 0) {
            v = 50;
        }

        temp_res->set_value(v);
        printf("temp change to: %d \n", v);

    }
    
    
}
void humidity_change() {
    int newDiff = rand() % 5 + 1;
    int v = 0;
    if((rand() % 2) == 1) {
            v = humidity_res->get_value_int() + newDiff;
    } else {
            v = humidity_res->get_value_int() - newDiff;
    }
    if(v > 100 || v < 0) {
        v = 50;
    }

    humidity_res->set_value(v);    
    printf("humidity change to: %d \n", v);

    float humidity = sht31.readHumidity() * 100;
    printf("humidity sensor read: %.1f \n", humidity);
}
void pressure_change() {
    int newDiff = rand() % 5 + 1;
    int v = 0;
    if((rand() % 2) == 1) {
            v = pressure_res->get_value_int() + newDiff;
    } else {
            v = pressure_res->get_value_int() - newDiff;
    }
    if(v > 100 || v < 0) {
        v = 50;
    }

    pressure_res->set_value(v);
    printf("pressure change to: %d \n", v);
}

void refresh_sensors() {
    fake_button_press();
    light_change();
    soil_change();
    temp_change();
    humidity_change();
    pressure_change();

    // lcd.cls();

    // float temp = sht31.readTemperature();
    // float humidity = sht31.readHumidity();

    // lcd.locate(3, 3);
    // lcd.printf("Temperature: %.2f C", temp);
    // lcd.locate(3, 13);
    // lcd.printf("Humidity: %.2f %%", humidity);    
}

/**
 * PUT handler
 * @param resource The resource that triggered the callback
 * @param newValue Updated value for the resource
 */
void pattern_updated(MbedCloudClientResource *resource, m2m::String newValue) {
    printf("PUT received, new value: %s\n", newValue.c_str());
}

void blink() {
    static DigitalOut augmentedLed(LED1); // LED that is used for blinking the pattern
    augmentedLed = !augmentedLed;
}

/**
 * POST handler
 * @param resource The resource that triggered the callback
 * @param buffer If a body was passed to the POST function, this contains the data.
 *               Note that the buffer is deallocated after leaving this function, so copy it if you need it longer.
 * @param size Size of the body
 */
void blink_callback(MbedCloudClientResource *resource, const uint8_t *buffer, uint16_t size) {
    printf("POST received. Going to blink LED pattern: %s\n", pattern_res->get_value().c_str());

    // Parse the pattern string, and toggle the LED in that pattern
    string s = std::string(pattern_res->get_value().c_str());
    size_t i = 0;
    size_t pos = s.find(':');
    int total_len = 0;
    while (pos != string::npos) {
        int len = atoi(s.substr(i, pos - i).c_str());

        mbed_event_queue()->call_in(total_len + len, &blink);

        total_len += len;
        i = ++pos;
        pos = s.find(':', pos);
    }
}

/**
 * Notification callback handler
 * @param resource The resource that triggered the callback
 * @param status The delivery status of the notification
 */
void button_callback(MbedCloudClientResource *resource, const NoticationDeliveryStatus status) {
    printf("Button notification, status %s (%d)\n", MbedCloudClientResource::delivery_status_to_string(status), status);
}

/**
 * Registration callback handler
 * @param endpoint Information about the registered endpoint such as the name (so you can find it back in portal)
 */
void registered(const ConnectorClientEndpointInfo *endpoint) {
    printf("Connected to Pelion Device Management. Endpoint Name: %s\n", endpoint->internal_endpoint_name.c_str());
}

int main() {
    NetworkInterface *net = NetworkInterface::get_default_instance();
    nsapi_error_t status = net->connect();

    if (status != NSAPI_ERROR_OK) {
        printf("Connecting to the network failed %d!\n", status);
        return -1;
    }

    // mbed_trace_init();

    printf("Connected to the network successfully. IP address: %s\n", net->get_ip_address());

    // SimpleMbedCloudClient handles registering over LwM2M to Mbed Cloud
    SimpleMbedCloudClient client(net, &bd);
    int client_status = client.init();
    if (client_status != 0) {
        printf("Pelion Client initialization failed (%d)\n", client_status);
        return -1;
    }

    printf("Pelion Client initialized\n");

    // Creating resources, which can be written or read from the cloud
    button_res = client.create_resource("3200/0/5501", "button_count");
    button_res->set_value(0);
    button_res->methods(M2MMethod::GET);
    button_res->observable(true);
    button_res->attach_notification_callback(button_callback);

    pattern_res = client.create_resource("3201/0/5853", "blink_pattern");
    pattern_res->set_value("500:500:500:500:500:500:500:500");
    pattern_res->methods(M2MMethod::GET | M2MMethod::PUT);
    pattern_res->attach_put_callback(pattern_updated);

    MbedCloudClientResource *blink_res = client.create_resource("3201/0/5850", "blink_action");
    blink_res->methods(M2MMethod::POST);
    blink_res->attach_post_callback(mbed_event_queue()->event(blink_callback));

    light_res = client.create_resource("/3203/0/5510", "light_level");
    light_res->set_value(50);
    light_res->methods(M2MMethod::GET);
    light_res->observable(true);

    soil_res = client.create_resource("/3203/0/5511", "soil_level");
    soil_res->set_value(50);
    soil_res->methods(M2MMethod::GET);
    soil_res->observable(true);

    temp_res = client.create_resource("/3203/0/5512", "temp_level");
    temp_res->set_value(50);
    temp_res->methods(M2MMethod::GET);
    temp_res->observable(true);

    pressure_res = client.create_resource("/3203/0/5513", "pressure_level");
    pressure_res->set_value(1000);
    pressure_res->methods(M2MMethod::GET);
    pressure_res->observable(true);

    humidity_res = client.create_resource("/3203/0/5514", "humidity_level");
    humidity_res->set_value(1000);
    humidity_res->methods(M2MMethod::GET);
    humidity_res->observable(true);

    // Callback that fires when registering is complete
    client.on_registered(&registered);

    // Register with Pelion Device Management
    int b = client.register_and_connect();

    // The timer fires on an interrupt context, but debounces it to the eventqueue, so it's safe to do network operations
    Ticker timer;
    timer.attach(mbed_event_queue()->event(&refresh_sensors), 5.0);

    mbed_event_queue()->call_every(1, &eventOS_scheduler_run_until_idle);

    mbed_event_queue()->dispatch_forever();

    wait(osWaitForever);
}
