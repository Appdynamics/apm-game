#!/bin/bash
APPDYNAMICS_AGENT_UNIQUE_HOST_ID=$(sed -rn '1s#.*/##; 1s/(.{12}).*/\1/p' /proc/self/cgroup)
dotnet dotnetcore.dll
