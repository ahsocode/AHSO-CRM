#!/usr/bin/env python3
"""Exercise the Bash 3.2 helper with a Docker stub; never prune real cache."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

HELPER = Path(__file__).with_name("docker-cache.sh").resolve()


class DockerCacheTest(unittest.TestCase):
    def run_helper(self, size: str, prune_status: int = 0, df_status: int = 0):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            calls = directory / "calls"
            docker = directory / "docker"
            docker.write_text('''#!/bin/bash
printf '%s\\n' "$*" >> "$QA_DOCKER_CALLS"
if [[ "$1 $2" == "system df" ]]; then
  printf 'Images 10GB\\nContainers 2GB\\nLocal Volumes 30GB\\nBuild Cache %s\\n' "$QA_DOCKER_SIZE"
  exit "$QA_DOCKER_DF_STATUS"
elif [[ "$*" == "builder prune -f --filter until=72h" ]]; then
  exit "$QA_DOCKER_PRUNE_STATUS"
fi
exit 17
''')
            docker.chmod(0o755)
            environment = dict(os.environ, PATH=f"{directory}:{os.environ['PATH']}",
                               QA_DOCKER_CALLS=str(calls), QA_DOCKER_SIZE=size,
                               QA_DOCKER_PRUNE_STATUS=str(prune_status), QA_DOCKER_DF_STATUS=str(df_status))
            result = subprocess.run(["/bin/bash", "-c", 'source "$1"; prune_old_docker_build_cache', "cache-test", str(HELPER)],
                                    env=environment, capture_output=True, text=True)
            return result, calls.read_text().splitlines()

    def test_strict_threshold_and_unit_conversion(self):
        for size, should_prune in [("0B", False), ("100kB", False), ("4999MB", False),
                                   ("5000MB", False), ("5GB", False), ("5.01GB", True),
                                   ("5000.1MB", True), ("5000001kB", True), ("0.006TB", True)]:
            with self.subTest(size=size):
                result, calls = self.run_helper(size)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(calls[0], "system df --format {{.Type}} {{.Size}}")
                self.assertEqual(calls[1:], ["builder prune -f --filter until=72h"] if should_prune else [])
                self.assertEqual("[qa] pruned Docker build cache" in result.stdout, should_prune)

    def test_unavailable_or_unrecognized_usage_does_not_prune(self):
        for size, status in [("unknown", 0), ("8GB", 1)]:
            result, calls = self.run_helper(size, df_status=status)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(len(calls), 1)
            self.assertNotIn("pruned Docker", result.stdout)

    def test_prune_failure_is_propagated_without_claiming_success(self):
        result, calls = self.run_helper("6GB", prune_status=1)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(calls), 2)
        self.assertNotIn("pruned Docker", result.stdout)


if __name__ == "__main__":
    unittest.main()
