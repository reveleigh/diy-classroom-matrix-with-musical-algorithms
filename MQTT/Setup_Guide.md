# MQTT & Node-RED Setup Guide

This project uses MQTT (via Mosquitto) and Node-RED as a middleware layer to securely bridge the Next.js web interface (hosted on a service like Vercel) and the Raspberry Pi running the LED Matrix code on your local network.

---

## 1. Setting Up the Mosquitto Broker

You need an MQTT broker running on your local network. This is usually installed on a secondary Raspberry Pi or a home server.

1. **Install Mosquitto:**
   ```bash
   sudo apt update
   sudo apt install mosquitto mosquitto-clients
   ```

2. **Configure Authentication:**
   Create a password file and add a user (e.g., `matrixuser`):
   ```bash
   sudo mosquitto_passwd -c /etc/mosquitto/passwd matrixuser
   ```

3. **Configure the Listener:**
   Create a config file at `/etc/mosquitto/conf.d/default.conf` and add:
   ```text
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   listener 1883 0.0.0.0
   ```

4. **Restart Mosquitto:**
   ```bash
   sudo systemctl restart mosquitto
   ```

---

## 2. Setting Up Node-RED

Node-RED acts as the bridge. It receives HTTP POST requests from your Next.js API route and forwards them as MQTT payloads.

1. **Install Node-RED:**
   Follow the [official installation guide](https://nodered.org/docs/getting-started/raspberrypi).

2. **Create the Flow:**
   * Drag in an **HTTP In** node. Set the method to `POST` and the URL to `/api/matrix-control`.
   * Connect it to a **JSON** parser node (if needed, though HTTP In usually parses JSON bodies automatically).
   * Connect it to an **MQTT Out** node.
     * Configure the MQTT Out node to point to your Mosquitto broker IP.
     * Set the topic to `classroom/matrix/control`.
     * Add your MQTT username and password in the node's security tab.
   * Finally, connect the HTTP node to an **HTTP Response** node to reply `200 OK` back to the web server.

3. **Deploy the Flow.** Node-RED will now act as a webhook receiver, forwarding commands to the Matrix!

---

## 3. Configuring the Python Script

Open `config.json` inside the `LED Matrix Code` directory on your Raspberry Pi.
Replace the `<PLACEHOLDER>` tags with your actual network credentials:

```json
{
  "mqtt_host": "192.168.X.X",
  "mqtt_port": 1883,
  "mqtt_transport": "tcp",
  "mqtt_username": "matrixuser",
  "mqtt_password": "yourpassword123",
  ...
}
```

## 4. Configuring the Next.js Dashboard

In your Next.js project, add these environment variables to your `.env.local` file (or your Vercel project settings):

```env
# The URL pointing to your Node-RED HTTP endpoint (you will need a reverse proxy or tunnel if accessing externally)
MATRIX_API_URL=https://your-node-red-instance.com/api/matrix-control

# An API key to authenticate requests against your Node-RED proxy (Optional, but recommended)
MATRIX_API_KEY=your_secret_key
```
