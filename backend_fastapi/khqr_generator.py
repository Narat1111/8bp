import subprocess
import json
import os

def generate_khqr_node(amount: float):
    """
    Calls the official node bakong-khqr library locally to generate a true EMV string & MD5. 
    This is extremely reliable and robust.
    """
    node_script = """
const { BakongKHQR, IndividualInfo } = require('../backend/node_modules/bakong-khqr');
const amount = parseFloat(process.argv[2]);
const khqr = new BakongKHQR();
const info = new IndividualInfo(
    'chheak_narat@bkrt',
    'CHHEAK NARAT',
    'Phnom Penh',
    {
        currency: '840', // USD
        amount: amount,
        expirationTimestamp: (Date.now() + 2 * 60 * 1000).toString()
    }
);
const result = khqr.generateIndividual(info);
console.log(JSON.stringify(result.data));
    """
    
    script_path = os.path.join(os.path.dirname(__file__), "temp_qr.js")
    with open(script_path, "w") as f:
        f.write(node_script)
        
    try:
        proc = subprocess.run(["node", script_path, str(amount)], capture_output=True, text=True)
        if proc.returncode != 0:
            return None, None
            
        data = json.loads(proc.stdout)
        return data.get("qr"), data.get("md5")
    except Exception as e:
        print("Error generating node QR:", e)
        return None, None
