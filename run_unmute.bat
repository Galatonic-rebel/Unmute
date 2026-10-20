@echo off
REM unmute launcher — starts the Streamlit shell (dashboard + local engine server)
cd /d "%~dp0"
python -m streamlit run unmute_app.py
pause
