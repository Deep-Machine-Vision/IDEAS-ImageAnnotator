##Virtualenv Settings
activate_this = '/export/www/strauss/venv/bin/activate'
execfile(activate_this, dict(__file__=activate_this))

##Replace the standard out
sys.stdout = sys.stderr

##Add this file path to sys.path in order to import settings
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '../..'))

##Add this file path to sys.path in order to import app
sys.path.append('/export/www/strauss/image-annotator/')

##Create appilcation for our app
from grabcut import app as application
