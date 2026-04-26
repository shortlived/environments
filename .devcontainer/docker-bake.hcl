variable "REPO" {
  default = "lynsei"
}
variable "PROGRAM" {
  default = "devcontainer"
}
variable "TAG" {
  default = "latest"
}

target "dind" {
  context = "."
  dockerfile = "Dockerfile.dind"
  tags = ["${REPO}/${PROGRAM}.dind:${TAG}"]
  no-cache = true
  platforms = ["linux/arm64","linux/amd64"]
}

target "simple" {
  context = "."
  dockerfile = "Dockerfile.simple"
  tags = ["${REPO}/${PROGRAM}.deno:${TAG}"]
  no-cache = true
  platforms = ["linux/arm64","linux/amd64"]
}