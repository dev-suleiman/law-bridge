terraform {
    backend "s3" {
        bucket         = "lawbridge-infra-terraform-state"
        key            = "lawbridge-state/terraform.tfstate"
        region         = "eu-north-1"
        use_lockfile = true
        encrypt        = true
    }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}