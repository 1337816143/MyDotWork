@echo off
setlocal
rem Run from a VS Developer Command Prompt, or call VsDevCmd.bat first.
pushd "%~dp0"
if not exist build mkdir build
cl /nologo /std:c++17 /utf-8 /EHsc /W4 /WX /permissive- /Iinclude /Fobuild\ /Febuild\candidate_guard_tests.exe src\candidate_guard.cpp tests\candidate_guard_tests.cpp
if errorlevel 1 goto :failed
build\candidate_guard_tests.exe
if errorlevel 1 goto :failed
popd
exit /b 0
:failed
popd
exit /b 1
